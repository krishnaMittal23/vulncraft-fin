import logging
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from typing import Dict, List, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

@dataclass
class ScanResult:
    success: bool
    data: Dict
    error: Optional[str] = None

class BaseScanner:
    def __init__(self, timeout: int = 300):
        self.timeout = timeout

    def _run_command(self, cmd: List[str], timeout: Optional[int] = None) -> subprocess.CompletedProcess:
        try:
            return subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout or self.timeout,
                check=True
            )
        except subprocess.TimeoutExpired as e:
            logger.error(f"Command timed out after {e.timeout}s: {' '.join(cmd)}")
            raise
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed with code {e.returncode}: {' '.join(cmd)}")
            raise

class DirectoryScanner(BaseScanner):
    def __init__(self, wordlist_path: str = "/usr/share/wordlists/dirb/common.txt"):
        super().__init__()
        self.wordlist_path = wordlist_path

    def scan(self, url: str) -> ScanResult:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            try:
                cmd = [
                    "gobuster", "dir",
                    "--url", url,
                    "--wordlist", self.wordlist_path,
                    "--quiet",
                    "-k",
                    "-t", "50",
                    "-r",
                    "--timeout", "30s",
                    "--no-error",
                    "--output", temp_file.name
                ]

                self._run_command(cmd)
                
                with open(temp_file.name, 'r') as f:
                    results = f.read()
                    parsed = self._parse_results(results)
                    return ScanResult(success=True, data=parsed)

            except Exception as e:
                logger.error(f"Directory scan failed: {str(e)}")
                return ScanResult(
                    success=False,
                    data={"directories": [], "files": []},
                    error=str(e)
                )
            finally:
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)

    def _parse_results(self, results: str) -> Dict:
        directories = []
        files = []
        
        logger.info(f"Parsing scan results, length: {len(results)}")
        pattern = re.compile(r'^([^\s]+)\s+\(Status:\s*(\d+)\)', re.MULTILINE)
        
        matches = list(pattern.finditer(results))
        logger.info(f"Found {len(matches)} matches in output")
        
        for match in matches:
            path = match.group(1)
            status = int(match.group(2))
            
            if not path.startswith('/'):
                path = '/' + path
                
            if 200 <= status < 400:
                entry = {'path': path, 'status': status}
                if '.' in path.rstrip('/').split('/')[-1]:
                    files.append(entry)
                else:
                    directories.append(entry)
        
        return {
            "directories": directories,
            "files": files
        }

class SecurityScanner:
    def __init__(self):
        self.dir_scanner = DirectoryScanner()
        self._setup_logging()

    def _setup_logging(self):
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

    def validate_url(self, url: str) -> bool:
        if not url:
            return False
        parsed = urlparse(url)
        return bool(parsed.scheme and parsed.netloc)

    def scan_target(self, url: str, options: Dict = None) -> Dict:
        if not self.validate_url(url):
            return {"error": "Invalid URL provided"}

        options = options or {}
        results = {
            "target_url": url,
            "scan_results": {}
        }

        # Directory enumeration
        dir_results = self.dir_scanner.scan(url)
        results["scan_results"]["directory_scan"] = dir_results.data

        # Additional scans based on options
        if options.get("run_nikto"):
            results["scan_results"]["nikto_scan"] = self._run_nikto_scan(url)

        if options.get("run_sqlmap"):
            results["scan_results"]["sqlmap_scan"] = self._run_sqlmap_scan(url)

        return results

    def _run_nikto_scan(self, url: str) -> Dict:
        try:
            with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.json') as temp_output:
                cmd = [
                    "nikto",
                    "-h", url,
                    "-Format", "json",
                    "-o", temp_output.name,
                    "-timeout", "300"
                ]
                
                subprocess.run(cmd, check=True, capture_output=True, text=True)
                
                with open(temp_output.name, 'r') as f:
                    return {"success": True, "data": f.read()}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            if os.path.exists(temp_output.name):
                os.unlink(temp_output.name)

    def _run_sqlmap_scan(self, url: str) -> Dict:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                cmd = [
                    "sqlmap",
                    "-u", url,
                    "--batch",
                    "--level=1",
                    "--risk=1",
                    "--output-dir", tmpdir,
                    "--random-agent"
                ]
                
                process = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=150
                )
                
                return {
                    "success": True,
                    "output": process.stdout,
                    "findings": self._parse_sqlmap_output(process.stdout)
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _parse_sqlmap_output(self, output: str) -> Dict:
        findings = []
        is_vulnerable = False
        
        if "is vulnerable" in output.lower():
            is_vulnerable = True
            
        for line in output.splitlines():
            if "Parameter" in line and "is vulnerable" in line:
                findings.append(line.strip())
                
        return {
            "vulnerable": is_vulnerable,
            "findings": findings
        }