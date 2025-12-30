from django.urls import path
from .views import scan_vulnerability, owasp_scan, owasp_zap_baseline, owasp_dependency_check

urlpatterns = [
    path('scan/', scan_vulnerability, name='scan_vulnerability'),
    path('owasp/', owasp_scan, name='owasp_scan'),
    path('owasp-baseline/', owasp_zap_baseline, name='owasp_zap_baseline'),
    path('owasp-dependency/', owasp_dependency_check, name='owasp_dependency_check'),
]
