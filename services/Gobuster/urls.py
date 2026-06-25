from django.urls import path
from .views import (
    scan_vulnerability,
    owasp_scan,
    owasp_zap_baseline,
    owasp_dependency_check,
    web_hygiene_scan,
    nuclei_scan,
    js_recon_scan,
    code_scan,
)

urlpatterns = [
    path('scan/', scan_vulnerability, name='scan_vulnerability'),
    path('owasp/', owasp_scan, name='owasp_scan'),
    path('owasp-baseline/', owasp_zap_baseline, name='owasp_zap_baseline'),
    path('owasp-dependency/', owasp_dependency_check, name='owasp_dependency_check'),
    path('web-hygiene/', web_hygiene_scan, name='web_hygiene_scan'),
    path('nuclei/', nuclei_scan, name='nuclei_scan'),
    path('js-recon/', js_recon_scan, name='js_recon_scan'),
    path('code-scan/', code_scan, name='code_scan'),
]
