import json
import subprocess
import os
import re
import logging
import requests
import tempfile
import uuid
from datetime import datetime
from urllib.parse import urlparse, urljoin
from typing import Dict, List, Any, Optional
import time

# Import OWASP ZAP Python API
try:
    from zapv2 import ZAPv2
except ImportError:
    ZAPv2 = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class OWASPScanner:
    """
    Comprehensive OWASP security scanner integrating multiple OWASP tools:
    - OWASP ZAP for web application security testing
    - OWASP Dependency Check for vulnerability analysis
    - Security best practices validation
    """
    
    def __init__(self, zap_url: str = None):
        # Use environment variable or default to Docker service name
        if zap_url is None:
            zap_url = os.getenv('OWASP_ZAP_URL', 'http://owasp-zap:8080')
        
        self.zap_url = zap_url
        self.zap = None
        self.zap_api_url = None
        self._initialize_zap()
        
    def _initialize_zap(self):
        """Initialize OWASP ZAP connection"""
        if ZAPv2 is None:
            logger.warning("ZAP Python API not available. Install with: pip install python-owasp-zap-v2.4")
            return
            
        try:
            # Extract host and port from URL
            parsed_url = urlparse(self.zap_url)
            host = parsed_url.hostname or 'localhost'
            port = parsed_url.port or 8080
            
            # Test if ZAP is accessible first
            logger.info(f"🔧 Testing ZAP connection to {host}:{port}...")
            test_response = requests.get(f"http://{host}:{port}/JSON/core/view/version/", timeout=10)
            if test_response.status_code != 200:
                raise Exception(f"ZAP not accessible: HTTP {test_response.status_code}")
            
            logger.info(f"✅ ZAP is accessible, version check passed")
            
            # Since zapv2 isn't available in container, use direct HTTP API calls
            self.zap = None  # Will use direct HTTP API calls instead
            self.zap_api_url = f"http://{host}:{port}"
            
            # Test connection with direct API call
            version_response = requests.get(f"{self.zap_api_url}/JSON/core/view/version/", timeout=10)
            if version_response.status_code == 200:
                version_data = version_response.json()
                version = version_data.get('version', 'Unknown')
                logger.info(f"✅ Connected to OWASP ZAP version: {version}")
            else:
                raise Exception("Failed to get ZAP version")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize OWASP ZAP: {str(e)}")
            logger.warning("Will fall back to basic security checks")
            self.zap = None
            self.zap_api_url = None

    def scan_target(self, url: str, options: Dict = None) -> Dict:
        """
        Comprehensive OWASP security scan of a target URL
        
        Args:
            url: Target URL to scan
            options: Additional scan options
            
        Returns:
            Dict containing scan results
        """
        if not options:
            options = {}
            
        scan_id = str(uuid.uuid4())[:8]
        logger.info(f"🔍 Starting OWASP security scan for {url} (ID: {scan_id})")
        
        results = {
            "scan_id": scan_id,
            "target_url": url,
            "timestamp": datetime.now().isoformat(),
            "zap_scan": {},
            "dependency_check": {},
            "owasp_top10_analysis": {},
            "security_headers": {},
            "total_vulnerabilities": 0,
            "risk_rating": "LOW",
            "scan_status": "completed"
        }
        
        try:
            # 1. OWASP ZAP Web Application Scan
            if self.zap_api_url:
                logger.info("🕷️ Running OWASP ZAP scan...")
                results["zap_scan"] = self._run_zap_scan(url, options)
            else:
                logger.warning("⚠️ ZAP not available, running basic web security checks...")
                results["zap_scan"] = self._run_basic_web_security_check(url)
            
            # 2. Security Headers Analysis
            logger.info("🔒 Analyzing security headers...")
            results["security_headers"] = self._analyze_security_headers(url)
            
            # 3. OWASP Top 10 Analysis
            logger.info("📊 Running OWASP Top 10 analysis...")
            results["owasp_top10_analysis"] = self._analyze_owasp_top10(url, results["zap_scan"])
            
            # 4. SSL/TLS Analysis
            logger.info("🔐 Analyzing SSL/TLS configuration...")
            results["ssl_analysis"] = self._analyze_ssl_tls(url)
            
            # 5. Calculate overall risk and vulnerability count
            results = self._calculate_overall_risk(results)

            # Surface the crawled routes at the top level so reports can show
            # which real URLs were discovered and scanned (not just the root).
            results["discovered_urls"] = results.get("zap_scan", {}).get("discovered_urls", [])

            logger.info(f"✅ OWASP scan completed. Found {results['total_vulnerabilities']} vulnerabilities with {results['risk_rating']} risk rating")
            
        except Exception as e:
            logger.error(f"❌ OWASP scan failed: {str(e)}")
            results["scan_status"] = "failed"
            results["error"] = str(e)
            
        return results

    def _run_zap_scan(self, url: str, options: Dict) -> Dict:
        """Run OWASP ZAP automated scan using direct HTTP API"""
        total_start_time = time.time()  # Track total scan time
        
        try:
            logger.info(f"🚀 Starting ZAP spider and active scan for {url}")
            
            if not self.zap_api_url:
                raise Exception("ZAP API not available")
            
            # Start spider scan
            logger.info("🕷️ Starting spider scan...")
            spider_response = requests.get(
                f"{self.zap_api_url}/JSON/spider/action/scan/",
                params={"url": url, "maxChildren": "10", "recurse": "true"},
                timeout=30
            )
            
            if spider_response.status_code != 200:
                raise Exception(f"Failed to start spider scan: {spider_response.status_code}")
            
            spider_data = spider_response.json()
            spider_id = spider_data.get('scan')
            logger.info(f"🕷️ Spider scan started (ID: {spider_id})")
            
            # Wait for spider to complete (with timeout)
            spider_timeout = 120  # 2 minutes for spider
            start_time = time.time()
            
            while time.time() - start_time < spider_timeout:
                status_response = requests.get(
                    f"{self.zap_api_url}/JSON/spider/view/status/",
                    params={"scanId": spider_id},
                    timeout=10
                )
                
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    progress = int(status_data.get('status', '0'))
                    logger.info(f"🕷️ Spider progress: {progress}%")
                    
                    if progress >= 100:
                        break
                        
                time.sleep(5)
            
            logger.info("✅ Spider scan completed")
            
            # Get spider results
            spider_results_response = requests.get(
                f"{self.zap_api_url}/JSON/spider/view/results/",
                params={"scanId": spider_id},
                timeout=30
            )
            
            spider_urls = []
            if spider_results_response.status_code == 200:
                spider_results_data = spider_results_response.json()
                spider_urls = spider_results_data.get('results', [])
                logger.info(f"�️ Spider found {len(spider_urls)} URLs")
            
            # Start active scan if enabled
            active_scan_enabled = options.get('active_scan', True)
            active_scan_results = {}
            
            if active_scan_enabled:
                logger.info("🔍 Starting active scan...")
                active_response = requests.get(
                    f"{self.zap_api_url}/JSON/ascan/action/scan/",
                    params={"url": url, "recurse": "true", "inScopeOnly": "false"},
                    timeout=30
                )
                
                if active_response.status_code == 200:
                    active_data = active_response.json()
                    active_scan_id = active_data.get('scan')
                    logger.info(f"🔍 Active scan started (ID: {active_scan_id})")
                    
                    # Wait for active scan (with timeout)
                    active_timeout = options.get('timeout', 300)  # Default 5 minutes
                    start_time = time.time()
                    
                    while time.time() - start_time < active_timeout:
                        status_response = requests.get(
                            f"{self.zap_api_url}/JSON/ascan/view/status/",
                            params={"scanId": active_scan_id},
                            timeout=10
                        )
                        
                        if status_response.status_code == 200:
                            status_data = status_response.json()
                            progress = int(status_data.get('status', '0'))
                            logger.info(f"🔍 Active scan progress: {progress}%")
                            
                            if progress >= 100:
                                break
                                
                        time.sleep(10)  # Check every 10 seconds for active scan
                    
                    logger.info("✅ Active scan completed")
            else:
                logger.info("⏩ Active scan disabled, skipping")
            
            # Get alerts/vulnerabilities
            logger.info("📊 Retrieving scan results...")
            alerts_response = requests.get(
                f"{self.zap_api_url}/JSON/core/view/alerts/",
                params={"baseurl": url},
                timeout=30
            )
            
            vulnerabilities = []
            risk_counts = {"High": 0, "Medium": 0, "Low": 0, "Informational": 0}
            
            if alerts_response.status_code == 200:
                alerts_data = alerts_response.json()
                alerts = alerts_data.get('alerts', [])
                
                logger.info(f"📊 Found {len(alerts)} alerts")
                
                for alert in alerts:
                    vuln = {
                        "alert_id": alert.get("id"),
                        "name": alert.get("alert"),
                        "risk": alert.get("risk"),
                        "confidence": alert.get("confidence"),
                        "description": alert.get("description"),
                        "solution": alert.get("solution"),
                        "reference": alert.get("reference"),
                        "param": alert.get("param"),
                        "attack": alert.get("attack"),
                        "evidence": alert.get("evidence"),
                        "url": alert.get("url")
                    }
                    vulnerabilities.append(vuln)
                    
                    # Count by risk level
                    risk_level = alert.get("risk", "Informational")
                    if risk_level in risk_counts:
                        risk_counts[risk_level] += 1
            else:
                logger.warning(f"⚠️ Failed to retrieve alerts: {alerts_response.status_code}")
            
            total_scan_time = time.time() - total_start_time
            
            return {
                "scan_completed": True,
                "vulnerabilities": vulnerabilities,
                "risk_counts": risk_counts,
                "total_alerts": len(vulnerabilities),
                "spider_urls_found": len(spider_urls),
                "discovered_urls": spider_urls[:200],
                "scan_duration_seconds": int(total_scan_time),
                "active_scan_enabled": active_scan_enabled,
                "method": "zap_http_api"
            }
            
        except Exception as e:
            logger.error(f"ZAP scan failed: {str(e)}")
            return {
                "scan_completed": False,
                "error": str(e),
                "vulnerabilities": [],
                "risk_counts": {"High": 0, "Medium": 0, "Low": 0, "Informational": 0}
            }
            
        except Exception as e:
            logger.error(f"ZAP scan failed: {str(e)}")
            return {
                "scan_completed": False,
                "error": str(e),
                "vulnerabilities": [],
                "risk_counts": {"High": 0, "Medium": 0, "Low": 0, "Informational": 0}
            }

    def _run_basic_web_security_check(self, url: str) -> Dict:
        """Fallback basic web security checks when ZAP is not available"""
        try:
            logger.info(f"🔍 Running basic web security check for {url}")
            
            response = requests.get(url, timeout=30, verify=False)
            vulnerabilities = []
            
            # Check for common security issues
            if response.status_code == 200:
                content = response.text.lower()
                headers = response.headers
                
                # Check for common vulnerabilities
                if 'password' in content and 'type="password"' in content and 'https' not in url.lower():
                    vulnerabilities.append({
                        "name": "Password field over HTTP",
                        "risk": "High",
                        "description": "Password field transmitted over unencrypted HTTP connection",
                        "solution": "Use HTTPS for all authentication forms"
                    })
                
                if 'sql error' in content or 'mysql error' in content:
                    vulnerabilities.append({
                        "name": "SQL Error Disclosure",
                        "risk": "Medium",
                        "description": "SQL error messages exposed in response",
                        "solution": "Implement proper error handling"
                    })
                
                # Check for missing security headers
                security_headers = ['x-frame-options', 'x-content-type-options', 'x-xss-protection']
                for header in security_headers:
                    if header not in [h.lower() for h in headers.keys()]:
                        vulnerabilities.append({
                            "name": f"Missing {header.upper()} header",
                            "risk": "Low",
                            "description": f"Security header {header} is missing",
                            "solution": f"Add {header} header to response"
                        })
            
            risk_counts = {"High": 0, "Medium": 0, "Low": 0, "Informational": 0}
            for vuln in vulnerabilities:
                risk_level = vuln.get("risk", "Informational")
                if risk_level in risk_counts:
                    risk_counts[risk_level] += 1
            
            return {
                "scan_completed": True,
                "vulnerabilities": vulnerabilities,
                "risk_counts": risk_counts,
                "total_alerts": len(vulnerabilities),
                "method": "basic_check"
            }
            
        except Exception as e:
            logger.error(f"Basic security check failed: {str(e)}")
            return {
                "scan_completed": False,
                "error": str(e),
                "vulnerabilities": [],
                "risk_counts": {"High": 0, "Medium": 0, "Low": 0, "Informational": 0}
            }

    def _analyze_security_headers(self, url: str) -> Dict:
        """Analyze HTTP security headers"""
        try:
            response = requests.head(url, timeout=10, verify=False)
            headers = response.headers
            
            security_headers = {
                'x-frame-options': 'Clickjacking protection',
                'x-content-type-options': 'MIME type sniffing protection',
                'x-xss-protection': 'XSS protection',
                'strict-transport-security': 'HTTP Strict Transport Security',
                'content-security-policy': 'Content Security Policy',
                'referrer-policy': 'Referrer Policy',
                'permissions-policy': 'Permissions Policy'
            }
            
            present_headers = {}
            missing_headers = {}
            
            for header, description in security_headers.items():
                header_value = headers.get(header, headers.get(header.title()))
                if header_value:
                    present_headers[header] = {
                        "value": header_value,
                        "description": description,
                        "status": "present"
                    }
                else:
                    missing_headers[header] = {
                        "description": description,
                        "status": "missing",
                        "risk": "Medium" if header in ['content-security-policy', 'strict-transport-security'] else "Low"
                    }
            
            return {
                "present_headers": present_headers,
                "missing_headers": missing_headers,
                "security_score": len(present_headers) / len(security_headers) * 100
            }
            
        except Exception as e:
            logger.error(f"Security headers analysis failed: {str(e)}")
            return {"error": str(e)}

    def _analyze_owasp_top10(self, url: str, zap_results: Dict) -> Dict:
        """Analyze against OWASP Top 10 vulnerabilities"""
        owasp_top10_2021 = {
            "A01": {"name": "Broken Access Control", "found": False, "details": []},
            "A02": {"name": "Cryptographic Failures", "found": False, "details": []},
            "A03": {"name": "Injection", "found": False, "details": []},
            "A04": {"name": "Insecure Design", "found": False, "details": []},
            "A05": {"name": "Security Misconfiguration", "found": False, "details": []},
            "A06": {"name": "Vulnerable and Outdated Components", "found": False, "details": []},
            "A07": {"name": "Identification and Authentication Failures", "found": False, "details": []},
            "A08": {"name": "Software and Data Integrity Failures", "found": False, "details": []},
            "A09": {"name": "Security Logging and Monitoring Failures", "found": False, "details": []},
            "A10": {"name": "Server-Side Request Forgery", "found": False, "details": []}
        }
        
        # Map ZAP vulnerabilities to OWASP Top 10
        if zap_results.get("vulnerabilities"):
            for vuln in zap_results["vulnerabilities"]:
                alert_name = vuln.get("name", "").lower()
                
                # A01 - Broken Access Control
                if any(term in alert_name for term in ["path traversal", "directory browsing", "access control"]):
                    owasp_top10_2021["A01"]["found"] = True
                    owasp_top10_2021["A01"]["details"].append(vuln["name"])
                
                # A02 - Cryptographic Failures
                if any(term in alert_name for term in ["ssl", "tls", "weak cipher", "crypto"]):
                    owasp_top10_2021["A02"]["found"] = True
                    owasp_top10_2021["A02"]["details"].append(vuln["name"])
                
                # A03 - Injection
                if any(term in alert_name for term in ["sql injection", "xss", "command injection", "ldap injection"]):
                    owasp_top10_2021["A03"]["found"] = True
                    owasp_top10_2021["A03"]["details"].append(vuln["name"])
                
                # A05 - Security Misconfiguration
                if any(term in alert_name for term in ["server header", "error disclosure", "debug"]):
                    owasp_top10_2021["A05"]["found"] = True
                    owasp_top10_2021["A05"]["details"].append(vuln["name"])
        
        # Calculate compliance score
        compliant_categories = sum(1 for cat in owasp_top10_2021.values() if not cat["found"])
        compliance_score = (compliant_categories / len(owasp_top10_2021)) * 100
        
        return {
            "categories": owasp_top10_2021,
            "compliance_score": compliance_score,
            "vulnerable_categories": [k for k, v in owasp_top10_2021.items() if v["found"]]
        }

    def _analyze_ssl_tls(self, url: str) -> Dict:
        """Analyze SSL/TLS configuration"""
        if not url.startswith('https://'):
            return {
                "ssl_enabled": False,
                "recommendation": "Enable HTTPS to secure data in transit"
            }
        
        try:
            import ssl
            import socket
            from urllib.parse import urlparse
            
            parsed_url = urlparse(url)
            hostname = parsed_url.hostname
            port = parsed_url.port or 443
            
            # Get SSL certificate info
            context = ssl.create_default_context()
            with socket.create_connection((hostname, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    protocol = ssock.version()
                    cipher = ssock.cipher()
            
            return {
                "ssl_enabled": True,
                "protocol": protocol,
                "cipher_suite": cipher[0] if cipher else "Unknown",
                "certificate_subject": dict(x[0] for x in cert.get('subject', [])),
                "certificate_issuer": dict(x[0] for x in cert.get('issuer', [])),
                "certificate_version": cert.get('version'),
                "not_after": cert.get('notAfter'),
                "security_assessment": "Good" if protocol in ['TLSv1.2', 'TLSv1.3'] else "Weak"
            }
            
        except Exception as e:
            return {
                "ssl_enabled": True,
                "error": f"SSL analysis failed: {str(e)}",
                "recommendation": "Verify SSL/TLS configuration"
            }

    def _calculate_overall_risk(self, results: Dict) -> Dict:
        """Calculate overall risk rating and total vulnerability count"""
        total_vulns = 0
        high_risk_count = 0
        medium_risk_count = 0
        
        # Count vulnerabilities from different scans
        if results.get("zap_scan", {}).get("risk_counts"):
            risk_counts = results["zap_scan"]["risk_counts"]
            total_vulns += sum(risk_counts.values())
            high_risk_count += risk_counts.get("High", 0)
            medium_risk_count += risk_counts.get("Medium", 0)
        
        # Add security header issues
        if results.get("security_headers", {}).get("missing_headers"):
            missing_headers = results["security_headers"]["missing_headers"]
            for header, info in missing_headers.items():
                total_vulns += 1
                if info.get("risk") == "Medium":
                    medium_risk_count += 1
        
        # Add OWASP Top 10 vulnerabilities
        if results.get("owasp_top10_analysis", {}).get("vulnerable_categories"):
            vulnerable_cats = len(results["owasp_top10_analysis"]["vulnerable_categories"])
            total_vulns += vulnerable_cats
            high_risk_count += vulnerable_cats  # OWASP Top 10 issues are high risk
        
        # Determine overall risk rating
        if high_risk_count > 0:
            risk_rating = "CRITICAL" if high_risk_count >= 3 else "HIGH"
        elif medium_risk_count > 0:
            risk_rating = "MEDIUM"
        elif total_vulns > 0:
            risk_rating = "LOW"
        else:
            risk_rating = "LOW"
        
        results["total_vulnerabilities"] = total_vulns
        results["risk_rating"] = risk_rating
        results["risk_breakdown"] = {
            "high": high_risk_count,
            "medium": medium_risk_count,
            "low": total_vulns - high_risk_count - medium_risk_count
        }
        
        return results

    def run_dependency_check(self, project_path: str = None) -> Dict:
        """Run OWASP Dependency Check for vulnerable dependencies"""
        try:
            logger.info("🔍 Running OWASP Dependency Check...")
            
            # This would integrate with OWASP Dependency Check
            # For now, return a placeholder structure
            return {
                "scan_completed": True,
                "vulnerable_dependencies": [],
                "total_dependencies": 0,
                "high_risk_dependencies": 0,
                "medium_risk_dependencies": 0,
                "recommendation": "Install OWASP Dependency Check for full dependency analysis"
            }
            
        except Exception as e:
            logger.error(f"Dependency check failed: {str(e)}")
            return {
                "scan_completed": False,
                "error": str(e)
            }

# Example usage and testing
if __name__ == "__main__":
    scanner = OWASPScanner()
    result = scanner.scan_target("http://example.com")
    print(json.dumps(result, indent=2))