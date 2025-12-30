from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
import json
import hmac
import hashlib
import logging
from .models import MonitoredRepository, PullRequestScan
from .services.scan_orchestrator import ScanOrchestrator
from .services.github_service import GitHubService

logger = logging.getLogger(__name__)


def verify_github_signature(request):
    """Verify GitHub webhook signature"""
    signature = request.headers.get('X-Hub-Signature-256', '')
    if not signature:
        return False
    
    expected = hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        request.body,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f'sha256={expected}', signature)


@csrf_exempt
@require_http_methods(["POST"])
def github_webhook(request):
    """Handle GitHub webhook events"""
    
    # Verify signature
    if not verify_github_signature(request):
        logger.warning("Invalid GitHub webhook signature")
        return JsonResponse({'error': 'Invalid signature'}, status=403)
    
    event_type = request.headers.get('X-GitHub-Event')
    payload = json.loads(request.body)
    
    logger.info(f"Received GitHub webhook: {event_type}")
    
    # Handle GitHub App Installation events
    if event_type == 'installation':
        return handle_installation_event(payload)
    
    # Handle GitHub App Installation Repositories events
    elif event_type == 'installation_repositories':
        return handle_installation_repositories_event(payload)
    
    # Handle Pull Request events
    elif event_type == 'pull_request':
        action = payload.get('action')
        
        if action in ['opened', 'synchronize', 'reopened']:
            return handle_pr_event(payload)
    
    # Handle Deployment Status events (for Netlify)
    elif event_type == 'deployment_status':
        return handle_deployment_status(payload)
    
    return JsonResponse({'status': 'ignored'}, status=200)


def handle_pr_event(payload):
    """Handle Pull Request opened/updated events"""
    pr = payload['pull_request']
    repo = payload['repository']
    
    # Check if repository is monitored
    try:
        monitored_repo = MonitoredRepository.objects.get(
            github_repo_id=repo['id'],
            is_active=True
        )
    except MonitoredRepository.DoesNotExist:
        logger.info(f"Repository {repo['full_name']} is not monitored")
        return JsonResponse({'status': 'repository not monitored'}, status=200)
    
    # Create or update scan record
    scan, created = PullRequestScan.objects.get_or_create(
        repository=monitored_repo,
        pr_number=pr['number'],
        pr_sha=pr['head']['sha'],
        defaults={
            'pr_title': pr['title'],
            'pr_branch': pr['head']['ref'],
            'status': 'waiting_preview'
        }
    )
    
    if not created:
        scan.pr_title = pr['title']
        scan.pr_branch = pr['head']['ref']
        scan.status = 'waiting_preview'
        scan.save()
    
    logger.info(f"Created/updated scan for PR #{pr['number']} in {repo['full_name']}")
    
    # Post initial comment
    github_service = GitHubService()
    initial_comment = f"""## 🔄 VulnCraft Security Scan

Your PR is being prepared for security scanning...

**Status:** Waiting for preview deployment
**PR:** #{pr['number']} - {pr['title']}
**Branch:** `{pr['head']['ref']}`

We'll update this comment once the preview is deployed and scans are complete.
"""
    
    try:
        comment = github_service.post_comment(
            repo['owner']['login'],
            repo['name'],
            pr['number'],
            initial_comment
        )
        scan.github_comment_id = comment['id']
        scan.save()
    except Exception as e:
        logger.error(f"Failed to post initial comment: {str(e)}")
    
    return JsonResponse({
        'status': 'scan_queued',
        'pr_number': pr['number'],
        'scan_id': scan.id
    }, status=200)


def handle_deployment_status(payload):
    """Handle deployment status updates from Netlify/Vercel/etc"""
    deployment = payload['deployment']
    deployment_status = payload['deployment_status']
    
    # Only process successful deployments
    if deployment_status['state'] != 'success':
        return JsonResponse({'status': 'ignored'}, status=200)
    
    # Get preview URL
    preview_url = deployment_status.get('environment_url') or deployment_status.get('target_url')
    if not preview_url:
        logger.warning("No preview URL found in deployment status")
        return JsonResponse({'status': 'no_preview_url'}, status=200)
    
    # Find the related PR scan
    repo = payload['repository']
    ref = deployment['ref']  # branch name
    
    try:
        monitored_repo = MonitoredRepository.objects.get(
            github_repo_id=repo['id'],
            is_active=True
        )
        
        # Find scan by branch
        scan = PullRequestScan.objects.filter(
            repository=monitored_repo,
            pr_branch=ref,
            status='waiting_preview'
        ).latest('created_at')
        
        scan.preview_url = preview_url
        scan.save()
        
        logger.info(f"Preview URL ready for PR #{scan.pr_number}: {preview_url}")
        
        # Start security scans in background
        from threading import Thread
        thread = Thread(target=run_scans_and_post_results, args=(scan.id,))
        thread.start()
        
        return JsonResponse({
            'status': 'scans_started',
            'preview_url': preview_url
        }, status=200)
        
    except MonitoredRepository.DoesNotExist:
        logger.info(f"Repository {repo['full_name']} is not monitored")
        return JsonResponse({'status': 'repository not monitored'}, status=200)
    except PullRequestScan.DoesNotExist:
        logger.warning(f"No pending scan found for branch {ref}")
        return JsonResponse({'status': 'no_pending_scan'}, status=200)


def run_scans_and_post_results(scan_id: int):
    """Run security scans and post results to PR (runs in background)"""
    try:
        scan = PullRequestScan.objects.get(id=scan_id)
        orchestrator = ScanOrchestrator()
        github_service = GitHubService()
        
        # Wait for preview to be fully ready
        if not orchestrator.wait_for_preview(scan.preview_url):
            scan.status = 'failed'
            scan.save()
            logger.error(f"Preview deployment timeout for scan {scan_id}")
            return
        
        # Run security scans
        results = orchestrator.run_security_scans(scan)
        
        # Format and post results
        markdown_results = github_service.format_scan_results(results)
        
        try:
            if scan.github_comment_id:
                # Update existing comment
                github_service.update_comment(
                    scan.repository.repo_owner,
                    scan.repository.repo_name,
                    scan.github_comment_id,
                    markdown_results
                )
            else:
                # Post new comment
                comment = github_service.post_comment(
                    scan.repository.repo_owner,
                    scan.repository.repo_name,
                    scan.pr_number,
                    markdown_results
                )
                scan.github_comment_id = comment['id']
                scan.save()
            
            logger.info(f"Posted scan results for PR #{scan.pr_number}")
            
        except Exception as e:
            logger.error(f"Failed to post results comment: {str(e)}")
            
    except Exception as e:
        logger.exception(f"Failed to run scans for scan {scan_id}")


@csrf_exempt
@require_http_methods(["POST"])
def netlify_webhook(request):
    """Handle Netlify deploy notifications"""
    try:
        payload = json.loads(request.body)
        logger.info(f"Received Netlify webhook: {payload.get('state', 'unknown')}")
        
        # Netlify payload structure:
        # {
        #   "id": "deploy_id",
        #   "state": "ready",
        #   "name": "site_name", 
        #   "url": "https://deploy-url.netlify.app",
        #   "ssl_url": "https://deploy-url.netlify.app",
        #   "branch": "branch_name",
        #   "deploy_ssl_url": "https://preview-url.netlify.app",
        #   "commit_ref": "sha",
        #   ...
        # }
        
        # Only process ready deployments
        if payload.get('state') != 'ready':
            return JsonResponse({'status': 'ignored'}, status=200)
        
        preview_url = payload.get('deploy_ssl_url') or payload.get('ssl_url') or payload.get('url')
        branch = payload.get('branch')
        commit_sha = payload.get('commit_ref')
        
        if not preview_url or not branch:
            logger.warning("Missing preview URL or branch in Netlify webhook")
            return JsonResponse({'status': 'missing_data'}, status=200)
        
        # Find matching PR scan by branch and commit
        scans = PullRequestScan.objects.filter(
            pr_branch=branch,
            status='waiting_preview'
        ).order_by('-created_at')
        
        if commit_sha:
            # Try to find by commit SHA first
            scan = scans.filter(pr_sha=commit_sha).first()
        else:
            # Fall back to just branch name
            scan = scans.first()
        
        if not scan:
            logger.warning(f"No matching PR scan found for branch {branch}")
            return JsonResponse({'status': 'no_matching_scan'}, status=200)
        
        # Update scan with preview URL
        scan.preview_url = preview_url
        scan.status = 'running'
        scan.save()
        
        logger.info(f"Starting scans for PR #{scan.pr_number} at {preview_url}")
        
        # Run scans in background
        import threading
        thread = threading.Thread(
            target=run_scans_and_post_results,
            args=(scan.id,)
        )
        thread.daemon = True
        thread.start()
        
        return JsonResponse({
            'status': 'scans_started',
            'preview_url': preview_url,
            'pr_number': scan.pr_number
        }, status=200)
        
    except Exception as e:
        logger.exception(f"Failed to process Netlify webhook: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def webhook_test(request):
    """Test endpoint to verify webhook is working"""
    return JsonResponse({
        'status': 'ok',
        'message': 'VulnCraft GitHub webhook is running'
    })


@csrf_exempt
@require_http_methods(["GET", "POST"])
def monitored_repositories(request):
    """
    GET: List all monitored repositories for the authenticated user
    POST: Add a new repository to monitor
    """
    # For now, using a simple user lookup. In production, use proper session auth
    # For cross-origin requests from Node.js backend, we'll accept a user identifier
    
    if request.method == "GET":
        try:
            # Get all active monitored repositories
            repos = MonitoredRepository.objects.filter(is_active=True).order_by('-created_at')
            
            data = [{
                'id': repo.id,
                'owner': repo.repo_owner,
                'name': repo.repo_name,
                'full_name': f"{repo.repo_owner}/{repo.repo_name}",
                'github_repo_id': repo.github_repo_id,
                'is_active': repo.is_active,
                'created_at': repo.created_at.isoformat(),
                'scan_count': repo.pr_scans.count(),
            } for repo in repos]
            
            return JsonResponse({'repositories': data}, status=200)
            
        except Exception as e:
            logger.exception(f"Failed to fetch monitored repositories: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "POST":
        try:
            payload = json.loads(request.body)
            repo_owner = payload.get('owner')
            repo_name = payload.get('name')
            user_id = payload.get('user_id', 1)  # Default to admin user for now
            
            if not repo_owner or not repo_name:
                return JsonResponse({'error': 'owner and name are required'}, status=400)
            
            # Fetch repository info from GitHub API
            github_service = GitHubService()
            import requests
            
            response = requests.get(
                f'https://api.github.com/repos/{repo_owner}/{repo_name}',
                headers={'Authorization': f'token {settings.GITHUB_TOKEN}'},
                timeout=10
            )
            
            if response.status_code == 404:
                return JsonResponse({'error': 'Repository not found on GitHub'}, status=404)
            elif response.status_code != 200:
                return JsonResponse({'error': f'GitHub API error: {response.status_code}'}, status=500)
            
            repo_data = response.json()
            github_repo_id = repo_data['id']
            
            # Get or create user
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                # Create a default user if not exists
                user = User.objects.get(id=1)  # Use admin
            
            # Check if already monitored
            existing = MonitoredRepository.objects.filter(
                github_repo_id=github_repo_id
            ).first()
            
            if existing:
                if not existing.is_active:
                    existing.is_active = True
                    existing.save()
                    return JsonResponse({
                        'message': 'Repository reactivated',
                        'repository': {
                            'id': existing.id,
                            'owner': existing.repo_owner,
                            'name': existing.repo_name,
                            'full_name': f"{existing.repo_owner}/{existing.repo_name}",
                            'github_repo_id': existing.github_repo_id,
                            'is_active': existing.is_active,
                        }
                    }, status=200)
                else:
                    return JsonResponse({'error': 'Repository already monitored'}, status=400)
            
            # Create new monitored repository
            monitored_repo = MonitoredRepository.objects.create(
                user=user,
                repo_owner=repo_owner,
                repo_name=repo_name,
                github_repo_id=github_repo_id,
                is_active=True
            )
            
            logger.info(f"Added monitored repository: {repo_owner}/{repo_name} (ID: {github_repo_id})")
            
            return JsonResponse({
                'message': 'Repository added successfully',
                'repository': {
                    'id': monitored_repo.id,
                    'owner': monitored_repo.repo_owner,
                    'name': monitored_repo.repo_name,
                    'full_name': f"{monitored_repo.repo_owner}/{monitored_repo.repo_name}",
                    'github_repo_id': monitored_repo.github_repo_id,
                    'is_active': monitored_repo.is_active,
                }
            }, status=201)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.exception(f"Failed to add monitored repository: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_monitored_repository(request, repo_id):
    """Delete or deactivate a monitored repository"""
    try:
        repo = MonitoredRepository.objects.get(id=repo_id)
        repo.is_active = False
        repo.save()
        
        logger.info(f"Deactivated monitored repository: {repo.repo_owner}/{repo.repo_name}")
        
        return JsonResponse({
            'message': 'Repository monitoring disabled',
            'repository_id': repo_id
        }, status=200)
        
    except MonitoredRepository.DoesNotExist:
        return JsonResponse({'error': 'Repository not found'}, status=404)
    except Exception as e:
        logger.exception(f"Failed to delete monitored repository: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


def handle_installation_event(payload):
    """
    Handle GitHub App installation/uninstallation events.
    Automatically adds/removes repositories from monitoring.
    """
    action = payload.get('action')
    installation = payload.get('installation', {})
    installation_id = installation.get('id')
    account = installation.get('account', {})
    
    logger.info(f"GitHub App installation event: {action} by {account.get('login')} (installation_id: {installation_id})")
    
    if action == 'created':
        # When app is installed, add all selected repositories
        repositories = payload.get('repositories', [])
        added_count = 0
        
        # Get or create a default admin user for GitHub App installations
        from django.contrib.auth.models import User
        admin_user, _ = User.objects.get_or_create(
            username='github_app_admin',
            defaults={'is_staff': False, 'is_superuser': False}
        )
        
        for repo in repositories:
            monitored_repo, created = MonitoredRepository.objects.get_or_create(
                github_repo_id=repo['id'],
                defaults={
                    'user': admin_user,
                    'repo_owner': account['login'],
                    'repo_name': repo['name'],
                    'installation_id': installation_id,
                    'is_active': True
                }
            )
            
            if created:
                added_count += 1
                logger.info(f"Added repository to monitoring: {account['login']}/{repo['name']}")
            else:
                # Update installation_id if repo was previously added manually
                monitored_repo.installation_id = installation_id
                monitored_repo.is_active = True
                monitored_repo.save()
                logger.info(f"Updated existing repository: {account['login']}/{repo['name']}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'GitHub App installed. {added_count} repositories added to monitoring.',
            'repositories_count': len(repositories)
        }, status=200)
    
    elif action == 'deleted':
        # When app is uninstalled, deactivate all repositories from this installation
        deactivated = MonitoredRepository.objects.filter(
            installation_id=installation_id
        ).update(is_active=False)
        
        logger.info(f"Deactivated {deactivated} repositories from installation {installation_id}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'GitHub App uninstalled. {deactivated} repositories removed from monitoring.',
            'repositories_count': deactivated
        }, status=200)
    
    elif action == 'suspend':
        # When app is suspended, deactivate repositories
        suspended = MonitoredRepository.objects.filter(
            installation_id=installation_id
        ).update(is_active=False)
        
        logger.info(f"Suspended {suspended} repositories from installation {installation_id}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'GitHub App suspended. {suspended} repositories suspended.',
            'repositories_count': suspended
        }, status=200)
    
    elif action == 'unsuspend':
        # When app is unsuspended, reactivate repositories
        unsuspended = MonitoredRepository.objects.filter(
            installation_id=installation_id
        ).update(is_active=True)
        
        logger.info(f"Unsuspended {unsuspended} repositories from installation {installation_id}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'GitHub App unsuspended. {unsuspended} repositories reactivated.',
            'repositories_count': unsuspended
        }, status=200)
    
    return JsonResponse({'status': 'ignored', 'action': action}, status=200)


def handle_installation_repositories_event(payload):
    """
    Handle when repositories are added/removed from GitHub App installation.
    """
    action = payload.get('action')
    installation = payload.get('installation', {})
    installation_id = installation.get('id')
    account = installation.get('account', {})
    
    logger.info(f"GitHub App installation_repositories event: {action} (installation_id: {installation_id})")
    
    # Get or create a default admin user for GitHub App installations
    from django.contrib.auth.models import User
    admin_user, _ = User.objects.get_or_create(
        username='github_app_admin',
        defaults={'is_staff': False, 'is_superuser': False}
    )
    
    if action == 'added':
        # Repositories were added to the installation
        repositories_added = payload.get('repositories_added', [])
        added_count = 0
        
        for repo in repositories_added:
            monitored_repo, created = MonitoredRepository.objects.get_or_create(
                github_repo_id=repo['id'],
                defaults={
                    'user': admin_user,
                    'repo_owner': account['login'],
                    'repo_name': repo['name'],
                    'installation_id': installation_id,
                    'is_active': True
                }
            )
            
            if created:
                added_count += 1
                logger.info(f"Added repository to monitoring: {account['login']}/{repo['name']}")
            else:
                # Update installation_id and reactivate if previously deactivated
                monitored_repo.installation_id = installation_id
                monitored_repo.is_active = True
                monitored_repo.save()
                logger.info(f"Reactivated repository: {account['login']}/{repo['name']}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'{added_count} repositories added to monitoring.',
            'repositories_count': len(repositories_added)
        }, status=200)
    
    elif action == 'removed':
        # Repositories were removed from the installation
        repositories_removed = payload.get('repositories_removed', [])
        removed_count = 0
        
        for repo in repositories_removed:
            deactivated = MonitoredRepository.objects.filter(
                github_repo_id=repo['id'],
                installation_id=installation_id
            ).update(is_active=False)
            
            if deactivated > 0:
                removed_count += deactivated
                logger.info(f"Deactivated repository: {account['login']}/{repo['name']}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'{removed_count} repositories removed from monitoring.',
            'repositories_count': len(repositories_removed)
        }, status=200)
    
    return JsonResponse({'status': 'ignored', 'action': action}, status=200)
