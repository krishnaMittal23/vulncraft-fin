"""
OWASP Integration Test Suite
===========================

This script validates the complete OWASP integration in VulnCraft.
Run this after starting all services to ensure everything works correctly.
"""

import requests
import json
import time
import subprocess
import sys
from urllib.parse import urljoin

class VulnCraftOWASPTester:
    def __init__(self):
        self.django_url = "http://localhost:8000"
        self.backend_url = "http://localhost:3000"
        self.zap_url = "http://localhost:8080"
        self.results = {}
        
    def print_status(self, message, status="INFO"):
        status_icons = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️"
        }
        print(f"{status_icons.get(status, 'ℹ️')} {message}")
        
    def test_zap_service(self):
        """Test if OWASP ZAP container is running and accessible"""
        self.print_status("Testing OWASP ZAP service...")
        try:
            response = requests.get(f"{self.zap_url}/JSON/core/view/version/", timeout=10)
            if response.status_code == 200:
                version_info = response.json()
                self.print_status(f"ZAP version: {version_info.get('version', 'Unknown')}", "SUCCESS")
                return True
            else:
                self.print_status(f"ZAP returned status code: {response.status_code}", "ERROR")
                return False
        except requests.exceptions.RequestException as e:
            self.print_status(f"ZAP connection failed: {str(e)}", "ERROR")
            return False
            
    def test_django_owasp_endpoints(self):
        """Test Django OWASP endpoints"""
        self.print_status("Testing Django OWASP endpoints...")
        
        test_data = {
            "target_url": "https://httpbin.org",
            "active_scan": True,
            "spider": True,
            "timeout": 60,
            "owasp_top10_check": True,
            "security_headers_check": True
        }
        
        endpoints = [
            "/api/gobuster/owasp/",
            "/api/gobuster/owasp-baseline/",
            "/api/gobuster/owasp-dependency/"
        ]
        
        for endpoint in endpoints:
            try:
                url = urljoin(self.django_url, endpoint)
                
                if endpoint == "/api/gobuster/owasp-dependency/":
                    # Dependency check needs different payload
                    test_payload = {"project_path": "/tmp/test_project"}
                else:
                    test_payload = test_data
                    
                self.print_status(f"Testing endpoint: {endpoint}")
                response = requests.post(url, json=test_payload, timeout=30)
                
                if response.status_code in [200, 202]:
                    self.print_status(f"Endpoint {endpoint} responded successfully", "SUCCESS")
                    self.results[f"django{endpoint}"] = "SUCCESS"
                else:
                    self.print_status(f"Endpoint {endpoint} returned {response.status_code}", "WARNING")
                    self.results[f"django{endpoint}"] = f"WARNING-{response.status_code}"
                    
            except requests.exceptions.RequestException as e:
                self.print_status(f"Endpoint {endpoint} failed: {str(e)}", "ERROR")
                self.results[f"django{endpoint}"] = f"ERROR-{str(e)}"
                
    def test_backend_workflow_execution(self):
        """Test backend workflow execution with OWASP nodes"""
        self.print_status("Testing backend workflow execution...")
        
        # Test workflow with OWASP nodes
        test_workflow = {
            "workflowId": "test-owasp-workflow",
            "nodes": [
                {
                    "id": "1",
                    "type": "owasp-zap",
                    "data": {
                        "active_scan": True,
                        "spider": True,
                        "timeout": 60
                    }
                },
                {
                    "id": "2", 
                    "type": "owasp-baseline",
                    "data": {}
                }
            ],
            "edges": [
                {
                    "id": "e1-2",
                    "source": "1",
                    "target": "2"
                }
            ],
            "targetUrl": "https://httpbin.org"
        }
        
        try:
            url = urljoin(self.backend_url, "/api/workflow/execute")
            response = requests.post(url, json=test_workflow, timeout=60)
            
            if response.status_code in [200, 202]:
                self.print_status("Backend workflow execution successful", "SUCCESS")
                self.results["backend_workflow"] = "SUCCESS"
            else:
                self.print_status(f"Backend workflow returned {response.status_code}", "WARNING")
                self.results["backend_workflow"] = f"WARNING-{response.status_code}"
                
        except requests.exceptions.RequestException as e:
            self.print_status(f"Backend workflow test failed: {str(e)}", "ERROR")
            self.results["backend_workflow"] = f"ERROR-{str(e)}"
            
    def test_docker_containers(self):
        """Test if required Docker containers are running"""
        self.print_status("Checking Docker containers...")
        
        try:
            result = subprocess.run(
                ["docker", "ps", "--format", "table {{.Names}}\\t{{.Status}}"],
                capture_output=True,
                text=True,
                check=True
            )
            
            container_lines = result.stdout.strip().split('\\n')[1:]  # Skip header
            containers = {}
            
            for line in container_lines:
                if line.strip():
                    parts = line.split('\\t')
                    if len(parts) >= 2:
                        name = parts[0].strip()
                        status = parts[1].strip()
                        containers[name] = status
                        
            # Check for required containers
            required_containers = ["vulncraft-owasp-zap"]
            
            for container in required_containers:
                if container in containers:
                    if "Up" in containers[container]:
                        self.print_status(f"Container {container}: {containers[container]}", "SUCCESS")
                        self.results[f"container_{container}"] = "SUCCESS"
                    else:
                        self.print_status(f"Container {container}: {containers[container]}", "WARNING")
                        self.results[f"container_{container}"] = "WARNING"
                else:
                    self.print_status(f"Container {container}: Not found", "ERROR")
                    self.results[f"container_{container}"] = "ERROR"
                    
        except subprocess.CalledProcessError as e:
            self.print_status(f"Docker check failed: {str(e)}", "ERROR")
            self.results["docker_check"] = "ERROR"
        except FileNotFoundError:
            self.print_status("Docker command not found", "ERROR")
            self.results["docker_check"] = "ERROR"
            
    def test_file_structure(self):
        """Test if all required files exist"""
        self.print_status("Checking file structure...")
        
        required_files = [
            "services/docker-compose.yml",
            "services/requirements.txt",
            "services/Gobuster/services/owasp_scanner.py",
            "services/Gobuster/views.py",
            "services/Gobuster/urls.py",
            "backend/src/services/workflowExecutionServe.js",
            "backend/src/services/reportAnalysisServe.js",
            "frontend/src/components/workflowbuilder/OWASPNodeConfigDialog.tsx",
            "frontend/src/pages/Workflowbuilder.tsx",
            "frontend/src/types/workflow.tsx"
        ]
        
        import os
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        for file_path in required_files:
            full_path = os.path.join(base_path, file_path)
            if os.path.exists(full_path):
                self.print_status(f"File exists: {file_path}", "SUCCESS")
                self.results[f"file_{file_path.replace('/', '_')}"] = "SUCCESS"
            else:
                self.print_status(f"File missing: {file_path}", "ERROR")
                self.results[f"file_{file_path.replace('/', '_')}"] = "ERROR"
                
    def run_full_test_suite(self):
        """Run complete test suite"""
        self.print_status("🛡️ Starting VulnCraft OWASP Integration Test Suite")
        self.print_status("=" * 60)
        
        # Run all tests
        self.test_file_structure()
        self.test_docker_containers()
        self.test_zap_service()
        self.test_django_owasp_endpoints()
        self.test_backend_workflow_execution()
        
        # Generate summary
        self.print_status("\\n📊 Test Results Summary:")
        self.print_status("=" * 40)
        
        success_count = sum(1 for result in self.results.values() if result == "SUCCESS")
        warning_count = sum(1 for result in self.results.values() if "WARNING" in str(result))
        error_count = sum(1 for result in self.results.values() if "ERROR" in str(result))
        total_tests = len(self.results)
        
        self.print_status(f"Total tests: {total_tests}")
        self.print_status(f"Successful: {success_count}", "SUCCESS" if success_count > 0 else "INFO")
        self.print_status(f"Warnings: {warning_count}", "WARNING" if warning_count > 0 else "INFO")
        self.print_status(f"Errors: {error_count}", "ERROR" if error_count > 0 else "INFO")
        
        if error_count == 0 and warning_count == 0:
            self.print_status("🎉 All tests passed! OWASP integration is fully functional.", "SUCCESS")
        elif error_count == 0:
            self.print_status("✅ Integration mostly functional with minor warnings.", "WARNING")
        else:
            self.print_status("❌ Integration has errors that need to be addressed.", "ERROR")
            
        # Detailed results
        self.print_status("\\n📋 Detailed Results:")
        for test, result in self.results.items():
            status = "SUCCESS" if result == "SUCCESS" else ("WARNING" if "WARNING" in str(result) else "ERROR")
            self.print_status(f"{test}: {result}", status)
            
        return success_count, warning_count, error_count

if __name__ == "__main__":
    tester = VulnCraftOWASPTester()
    success, warning, error = tester.run_full_test_suite()
    
    # Exit with appropriate code
    if error > 0:
        sys.exit(1)
    elif warning > 0:
        sys.exit(2)
    else:
        sys.exit(0)