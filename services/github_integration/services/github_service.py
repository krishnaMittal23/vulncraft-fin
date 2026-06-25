import requests
import logging
from typing import Dict, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class GitHubService:
    """Service to interact with GitHub API"""
    
    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json"
        }
    
    def post_comment(self, repo_owner: str, repo_name: str, pr_number: int, body: str) -> Dict:
        """Post a comment on a pull request"""
        url = f"{self.base_url}/repos/{repo_owner}/{repo_name}/issues/{pr_number}/comments"
        
        try:
            response = requests.post(
                url,
                headers=self.headers,
                json={"body": body}
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to post comment: {str(e)}")
            raise
    
    def update_comment(self, repo_owner: str, repo_name: str, comment_id: int, body: str) -> Dict:
        """Update an existing comment"""
        url = f"{self.base_url}/repos/{repo_owner}/{repo_name}/issues/comments/{comment_id}"
        
        try:
            response = requests.patch(
                url,
                headers=self.headers,
                json={"body": body}
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to update comment: {str(e)}")
            raise
    
    def create_check_run(self, repo_owner: str, repo_name: str, head_sha: str, name: str) -> Dict:
        """Create a GitHub Check Run"""
        url = f"{self.base_url}/repos/{repo_owner}/{repo_name}/check-runs"
        
        payload = {
            "name": name,
            "head_sha": head_sha,
            "status": "in_progress",
            "started_at": self._get_timestamp()
        }
        
        try:
            response = requests.post(
                url,
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create check run: {str(e)}")
            raise
    
    def update_check_run(self, repo_owner: str, repo_name: str, check_run_id: int, 
                        status: str, conclusion: str = None, output: Dict = None) -> Dict:
        """Update a GitHub Check Run"""
        url = f"{self.base_url}/repos/{repo_owner}/{repo_name}/check-runs/{check_run_id}"
        
        payload = {
            "status": status,
            "completed_at": self._get_timestamp() if status == "completed" else None
        }
        
        if conclusion:
            payload["conclusion"] = conclusion
        if output:
            payload["output"] = output
        
        try:
            response = requests.patch(
                url,
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to update check run: {str(e)}")
            raise
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime
        return datetime.utcnow().isoformat() + "Z"
    
    def format_scan_results(self, scan_data: Dict) -> str:
        """Format scan results as markdown for PR comment"""
        
        total_findings = scan_data.get('total_findings', 0)
        status = scan_data.get('status', 'unknown')
        preview_url = scan_data.get('preview_url', 'N/A')
        
        # Emoji based on findings
        if total_findings == 0:
            emoji = "✅"
            conclusion = "No security issues detected"
        elif total_findings < 5:
            emoji = "⚠️"
            conclusion = f"Found {total_findings} potential issues"
        else:
            emoji = "🚨"
            conclusion = f"Found {total_findings} security issues"
        
        markdown = f"""## {emoji} VulnCraft Security Scan Results

**Preview URL:** {preview_url}
**Status:** {status}
**Total Findings:** {total_findings}

### Summary
{conclusion}

---

"""
        
        # Gobuster results
        if scan_data.get('gobuster_results'):
            gobuster = scan_data['gobuster_results']
            dirs = gobuster.get('directories_found', [])
            files = gobuster.get('files_found', [])
            
            markdown += f"""### 🔍 Directory Enumeration
- **Directories Found:** {len(dirs)}
- **Files Found:** {len(files)}

"""
            if dirs[:5]:
                markdown += "**Top Directories:**\n"
                for d in dirs[:5]:
                    markdown += f"- `{d.get('path')}` (Status: {d.get('status')})\n"
                markdown += "\n"
        
        # Vulnar results
        if scan_data.get('vulnar_results'):
            vulnar = scan_data['vulnar_results']
            open_ports = vulnar.get('open_ports', [])
            
            markdown += f"""### 🔌 Port Scanning
- **Open Ports:** {len(open_ports)}

"""
            if open_ports:
                markdown += "**Detected Ports:**\n"
                for port in open_ports[:10]:
                    markdown += f"- Port {port.get('port')}/{port.get('protocol')} - {port.get('service')}\n"
                markdown += "\n"
        
        # SQL injection results
        if scan_data.get('sqlmap_results'):
            sqlmap = scan_data['sqlmap_results']
            is_vulnerable = sqlmap.get('vulnerable', False)
            
            if is_vulnerable:
                markdown += """### 🚨 SQL Injection
**Warning:** Potential SQL injection vulnerabilities detected!

"""
                vulnerabilities = sqlmap.get('vulnerabilities', [])
                if vulnerabilities:
                    for vuln in vulnerabilities[:5]:
                        markdown += f"- {vuln}\n"
                markdown += "\n"
        
        markdown += """---
*Scan performed by [VulnCraft](https://github.com/CoderFleet/VulnCraft)*
"""
        
        return markdown
