# GitHub PR Security Testing Integration

This feature automatically runs security scans on Netlify preview deployments when PRs are created or updated.

## Features

- 🔄 Automatic PR monitoring
- 🚀 Runs security scans on preview deployments
- 💬 Posts scan results as PR comments
- 📊 Tracks scan history in Django admin
- ⚡ Supports Netlify, Vercel, and custom deployments

## Setup Guide

### 1. Install Dependencies

```bash
cd services
pip install -r requirements.txt
```

### 2. Run Database Migrations

```bash
python manage.py makemigrations github_integration
python manage.py migrate
```

### 3. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (full control of private repositories)
   - `write:discussion` (to post comments)
4. Copy the token

### 4. Set Environment Variables

Create a `.env` file or export these variables:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
export GITHUB_WEBHOOK_SECRET="your_random_secret_string"
```

Or add to `docker-compose.yml`:

```yaml
environment:
  - GITHUB_TOKEN=ghp_your_token_here
  - GITHUB_WEBHOOK_SECRET=your_random_secret_string
```

### 5. Configure GitHub Webhook

#### Option A: Using ngrok (for local development)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start ngrok tunnel
ngrok http 8000

# Copy the https URL (e.g., https://abc123.ngrok.io)
```

#### Option B: Using your production domain

Use your actual domain (e.g., https://vulncraft.yourcompany.com)

#### Configure the webhook on GitHub:

1. Go to your repository → Settings → Webhooks → Add webhook
2. **Payload URL:** `https://your-domain.com/api/github/webhook/`
3. **Content type:** `application/json`
4. **Secret:** (use the same value as `GITHUB_WEBHOOK_SECRET`)
5. **Events:** Select:
   - Pull requests
   - Deployment statuses
6. Click "Add webhook"

### 6. Register Repository for Monitoring

In Django admin (`http://localhost:8000/admin/`):

1. Go to "Monitored repositories"
2. Click "Add monitored repository"
3. Fill in:
   - User: Select your Django user
   - Repo owner: e.g., `CoderFleet`
   - Repo name: e.g., `my-frontend-app`
   - GitHub repo ID: (find this at `https://api.github.com/repos/owner/repo`)
   - Is active: ✓
4. Save

## How It Works

### Flow Diagram

```
PR Created/Updated
    ↓
GitHub sends webhook
    ↓
VulnCraft receives event
    ↓
Creates scan record
    ↓
Posts "waiting" comment
    ↓
Netlify deploys preview
    ↓
GitHub sends deployment_status webhook
    ↓
VulnCraft extracts preview URL
    ↓
Waits for preview to be ready
    ↓
Runs security scans:
  - Gobuster (directory enumeration)
  - Vulnar (port scanning)
  - Optional: SQLMap, Nikto
    ↓
Formats results as markdown
    ↓
Updates PR comment with results
```

### Example PR Comment

```markdown
## ✅ VulnCraft Security Scan Results

**Preview URL:** https://branch--site.netlify.app
**Status:** completed
**Total Findings:** 3

### Summary
Found 3 potential issues

---

### 🔍 Directory Enumeration
- **Directories Found:** 2
- **Files Found:** 1

**Top Directories:**
- `/admin` (Status: 200)
- `/api` (Status: 200)

### 🔌 Port Scanning
- **Open Ports:** 0

---
*Scan performed by [VulnCraft](https://github.com/CoderFleet/VulnCraft)*
```

## API Endpoints

### Webhook Endpoint
- **URL:** `/api/github/webhook/`
- **Method:** POST
- **Auth:** GitHub webhook signature verification
- **Events:** `pull_request`, `deployment_status`

### Test Endpoint
- **URL:** `/api/github/webhook/test/`
- **Method:** GET
- **Response:** `{"status": "ok", "message": "VulnCraft GitHub webhook is running"}`

## Django Admin

Access at `http://localhost:8000/admin/`

### Monitored Repositories
- View/manage repositories being monitored
- Enable/disable monitoring per repository

### Pull Request Scans
- View all PR scans and their status
- See detailed results for each scan
- Track scan history

### Scan Logs
- Detailed logs for debugging
- Filter by log level (INFO, WARNING, ERROR)

## Testing

### Test the webhook locally:

```bash
# Test endpoint
curl http://localhost:8000/api/github/webhook/test/

# Simulate PR event (replace with your data)
curl -X POST http://localhost:8000/api/github/webhook/ \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{"action":"opened","pull_request":{"number":1,"title":"Test PR","head":{"ref":"test-branch","sha":"abc123"}},"repository":{"id":123456,"full_name":"owner/repo","name":"repo","owner":{"login":"owner"}}}'
```

### Manual scan trigger:

```python
from github_integration.models import PullRequestScan
from github_integration.views import run_scans_and_post_results

# Get a scan
scan = PullRequestScan.objects.first()

# Run scans manually
run_scans_and_post_results(scan.id)
```

## Troubleshooting

### Webhook not receiving events
1. Check webhook delivery in GitHub (Settings → Webhooks → Recent Deliveries)
2. Verify webhook URL is publicly accessible
3. Check logs: `docker-compose logs -f web`

### Scans not starting
1. Verify monitored repository is active
2. Check scan status in Django admin
3. Review scan logs for errors

### Preview URL not detected
1. Ensure Netlify is posting deployment status to GitHub
2. Check deployment_status webhook events are enabled
3. Verify environment_url is present in webhook payload

### Comment not posted
1. Verify GITHUB_TOKEN has correct permissions
2. Check GitHub API rate limits
3. Review error logs

## Security Considerations

1. **Webhook Secret:** Always use a strong random secret
2. **GitHub Token:** Use a token with minimum required permissions
3. **Rate Limiting:** Consider adding rate limiting for webhook endpoints
4. **Resource Usage:** Long-running scans may consume significant resources
5. **Sensitive Data:** Be careful about exposing scan results publicly

## Future Enhancements

- [ ] Support for GitHub Checks API (show results inline)
- [ ] Celery integration for background job processing
- [ ] Email notifications for critical findings
- [ ] Custom scan configurations per repository
- [ ] Integration with other deployment platforms (Vercel, Render)
- [ ] Scan scheduling for existing deployments
- [ ] PDF report generation

## Support

For issues or questions, please open an issue on GitHub.
