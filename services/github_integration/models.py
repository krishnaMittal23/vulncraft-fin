from django.db import models
from django.contrib.auth.models import User


class MonitoredRepository(models.Model):
    """Repository being monitored for PRs"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='monitored_repos')
    repo_owner = models.CharField(max_length=255)
    repo_name = models.CharField(max_length=255)
    github_repo_id = models.BigIntegerField(unique=True)
    installation_id = models.BigIntegerField(null=True, blank=True)  # GitHub App installation ID
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['repo_owner', 'repo_name']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.repo_owner}/{self.repo_name}"


class PullRequestScan(models.Model):
    """Security scan results for a PR"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('waiting_preview', 'Waiting for Preview'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    repository = models.ForeignKey(MonitoredRepository, on_delete=models.CASCADE, related_name='pr_scans')
    pr_number = models.IntegerField()
    pr_title = models.CharField(max_length=500)
    pr_branch = models.CharField(max_length=255)
    pr_sha = models.CharField(max_length=40)
    preview_url = models.URLField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Scan results
    gobuster_results = models.JSONField(null=True, blank=True)
    vulnar_results = models.JSONField(null=True, blank=True)
    nikto_results = models.JSONField(null=True, blank=True)
    sqlmap_results = models.JSONField(null=True, blank=True)
    
    total_findings = models.IntegerField(default=0)
    critical_findings = models.IntegerField(default=0)
    
    # GitHub integration
    github_comment_id = models.BigIntegerField(null=True, blank=True)
    github_check_run_id = models.BigIntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['repository', 'pr_number', 'pr_sha']
        ordering = ['-created_at']

    def __str__(self):
        return f"PR #{self.pr_number} - {self.repository}"


class ScanLog(models.Model):
    """Detailed logs for scan execution"""
    scan = models.ForeignKey(PullRequestScan, on_delete=models.CASCADE, related_name='logs')
    level = models.CharField(max_length=20)  # INFO, WARNING, ERROR
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
