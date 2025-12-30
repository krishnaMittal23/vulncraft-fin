from django.contrib import admin
from .models import MonitoredRepository, PullRequestScan, ScanLog


@admin.register(MonitoredRepository)
class MonitoredRepositoryAdmin(admin.ModelAdmin):
    list_display = ['repo_owner', 'repo_name', 'user', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['repo_owner', 'repo_name', 'user__username']
    readonly_fields = ['github_repo_id', 'created_at', 'updated_at']


@admin.register(PullRequestScan)
class PullRequestScanAdmin(admin.ModelAdmin):
    list_display = ['pr_number', 'repository', 'status', 'total_findings', 'created_at']
    list_filter = ['status', 'created_at', 'repository']
    search_fields = ['pr_title', 'pr_branch', 'pr_number']
    readonly_fields = ['created_at', 'updated_at', 'completed_at']
    
    fieldsets = (
        ('Pull Request Info', {
            'fields': ('repository', 'pr_number', 'pr_title', 'pr_branch', 'pr_sha', 'preview_url')
        }),
        ('Scan Status', {
            'fields': ('status', 'total_findings', 'critical_findings')
        }),
        ('Results', {
            'fields': ('gobuster_results', 'vulnar_results', 'nikto_results', 'sqlmap_results'),
            'classes': ('collapse',)
        }),
        ('GitHub Integration', {
            'fields': ('github_comment_id', 'github_check_run_id')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'completed_at')
        }),
    )


@admin.register(ScanLog)
class ScanLogAdmin(admin.ModelAdmin):
    list_display = ['scan', 'level', 'message_preview', 'created_at']
    list_filter = ['level', 'created_at']
    search_fields = ['message']
    readonly_fields = ['scan', 'level', 'message', 'created_at']
    
    def message_preview(self, obj):
        return obj.message[:100] + '...' if len(obj.message) > 100 else obj.message
    message_preview.short_description = 'Message'
