import logging
import time
import requests
from typing import Dict, Optional
from django.conf import settings
from ..models import PullRequestScan, ScanLog

logger = logging.getLogger(__name__)


class ScanOrchestrator:
    """Orchestrates security scans on preview deployments"""
    
    def __init__(self):
        self.max_wait_time = 600  # 10 minutes
        self.check_interval = 15  # Check every 15 seconds
    
    def wait_for_preview(self, url: str) -> bool:
        """Wait for preview deployment to be ready"""
        logger.info(f"Waiting for preview deployment: {url}")
        
        start_time = time.time()
        while (time.time() - start_time) < self.max_wait_time:
            try:
                response = requests.get(url, timeout=10, allow_redirects=True)
                if response.status_code == 200:
                    logger.info(f"Preview deployment is ready: {url}")
                    return True
            except requests.exceptions.RequestException as e:
                logger.debug(f"Preview not ready yet: {str(e)}")
            
            time.sleep(self.check_interval)
        
        logger.error(f"Preview deployment timeout: {url}")
        return False
    
    def run_security_scans(self, scan: PullRequestScan) -> Dict:
        """Run all enabled security scans on the preview URL"""
        results = {
            'preview_url': scan.preview_url,
            'status': 'running',
            'total_findings': 0
        }
        
        try:
            # Update scan status
            scan.status = 'running'
            scan.save()
            self._log(scan, 'INFO', f'Starting security scans on {scan.preview_url}')
            
            # Run Gobuster scan
            self._log(scan, 'INFO', 'Running directory enumeration...')
            gobuster_results = self._run_gobuster(scan.preview_url)
            scan.gobuster_results = gobuster_results
            results['gobuster_results'] = gobuster_results
            
            # Count findings
            if gobuster_results:
                findings = len(gobuster_results.get('directories_found', [])) + \
                          len(gobuster_results.get('files_found', []))
                results['total_findings'] += findings
            
            # Run Vulnar (port scan) - on domain only
            self._log(scan, 'INFO', 'Running port scan...')
            vulnar_results = self._run_vulnar(scan.preview_url)
            scan.vulnar_results = vulnar_results
            results['vulnar_results'] = vulnar_results
            
            if vulnar_results and vulnar_results.get('open_ports'):
                results['total_findings'] += len(vulnar_results['open_ports'])
            
            # Optional: Run SQLMap if enabled
            # self._log(scan, 'INFO', 'Running SQL injection tests...')
            # sqlmap_results = self._run_sqlmap(scan.preview_url)
            # scan.sqlmap_results = sqlmap_results
            # results['sqlmap_results'] = sqlmap_results
            
            # Update scan record
            scan.total_findings = results['total_findings']
            scan.status = 'completed'
            results['status'] = 'completed'
            scan.save()
            
            self._log(scan, 'INFO', f'Scans completed. Total findings: {results["total_findings"]}')
            
        except Exception as e:
            logger.exception(f"Scan failed for PR #{scan.pr_number}")
            scan.status = 'failed'
            scan.save()
            self._log(scan, 'ERROR', f'Scan failed: {str(e)}')
            results['status'] = 'failed'
            results['error'] = str(e)
        
        return results
    
    def _run_gobuster(self, url: str) -> Dict:
        """Run Gobuster directory enumeration"""
        from Gobuster.views import scan_vulnerability
        from django.http import HttpRequest
        import json
        
        try:
            # Create a mock request
            request = HttpRequest()
            request.method = 'POST'
            request._body = json.dumps({'url': url}).encode('utf-8')
            
            # Call the scan function
            response = scan_vulnerability(request)
            
            if response.status_code == 200:
                return json.loads(response.content)
            else:
                logger.error(f"Gobuster scan failed: {response.content}")
                return {'directories_found': [], 'files_found': []}
                
        except Exception as e:
            logger.error(f"Gobuster scan error: {str(e)}")
            return {'directories_found': [], 'files_found': []}
    
    def _run_vulnar(self, url: str) -> Dict:
        """Run Vulnar port scan"""
        from Vulnar.views import scan_ports
        from django.http import HttpRequest
        from urllib.parse import urlparse
        import json
        
        try:
            # Extract domain from URL
            parsed = urlparse(url)
            domain = parsed.netloc
            
            # Create a mock request
            request = HttpRequest()
            request.method = 'POST'
            request._body = json.dumps({'target': domain, 'arguments': '-F'}).encode('utf-8')
            
            # Call the scan function
            response = scan_ports(request)
            
            if response.status_code == 200:
                return json.loads(response.content)
            else:
                logger.error(f"Vulnar scan failed: {response.content}")
                return {'open_ports': []}
                
        except Exception as e:
            logger.error(f"Vulnar scan error: {str(e)}")
            return {'open_ports': []}
    
    def _run_sqlmap(self, url: str) -> Dict:
        """Run SQLMap SQL injection tests"""
        # Implement if needed
        return {}
    
    def _log(self, scan: PullRequestScan, level: str, message: str):
        """Create a scan log entry"""
        ScanLog.objects.create(
            scan=scan,
            level=level,
            message=message
        )
        logger.log(getattr(logging, level), f"[PR #{scan.pr_number}] {message}")
