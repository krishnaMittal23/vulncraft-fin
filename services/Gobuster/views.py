import json
import subprocess
import os
import re
import logging
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import tempfile
from urllib.parse import urlparse

# Import OWASP scanner
from .services.owasp_scanner import OWASPScanner
from vulncraft.security import require_scanner_secret, validate_scan_target

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def scan_vulnerability(request):
    try:
        data = json.loads(request.body)
        target_url = data.get('url')
        
        # Validate URL
        if not target_url:
            return JsonResponse({'error': 'URL is required'}, status=400)
        
        # Ensure URL has a scheme
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url

        try:
            validate_scan_target(target_url)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)

        parsed_url = urlparse(target_url)
        domain = parsed_url.netloc
        
        logger.info(f"Starting vulnerability scan for {target_url}")
        
        # Run Gobuster
        gobuster_results = run_gobuster(target_url, extensions=data.get('gobuster_extensions'))
        
        # Structure the data
        structured_data = {
            'target_url': target_url,
            'scan_date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'directories_found': gobuster_results['directories'],
            'files_found': gobuster_results['files'],
        }
        
        # Initialize findings counter
        total_findings = len(gobuster_results['directories']) + len(gobuster_results['files'])
        logger.info(f"Initial total_findings from Gobuster: {total_findings}")
        
        # Add additional scan results if requested and available
        try:
            if data.get('run_nikto', False):
                logger.info("Running Nikto scan")
                nikto_result = run_nikto(target_url, tuning=data.get('nikto_tuning'))
                structured_data['nikto_scan'] = nikto_result
                # Count Nikto vulnerabilities if present
                if isinstance(nikto_result, dict) and 'vulnerabilities' in nikto_result:
                    nikto_count = len(nikto_result.get('vulnerabilities', []))
                    total_findings += nikto_count
                    logger.info(f"Added {nikto_count} Nikto vulnerabilities. Total: {total_findings}")
            
            if data.get('run_nmap', False):
                logger.info("Running Nmap scan")
                nmap_result = run_nmap(domain, arguments=data.get('nmap_arguments'))
                logger.info(f"Nmap result type: {type(nmap_result)}, keys: {nmap_result.keys() if isinstance(nmap_result, dict) else 'N/A'}")
                structured_data['nmap_scan'] = nmap_result
                # Count open ports as findings
                if isinstance(nmap_result, dict) and 'open_ports' in nmap_result:
                    port_count = len(nmap_result.get('open_ports', []))
                    logger.info(f"Nmap open_ports count: {port_count}")
                    total_findings += port_count
                    logger.info(f"Added {port_count} Nmap ports. Total: {total_findings}")
                else:
                    logger.warning(f"Nmap result missing open_ports or not a dict")
            
            if data.get('run_sqlmap', False) and data.get('test_url'):
                logger.info("Running SQLMap scan")
                sqlmap_result = run_sqlmap(data.get('test_url'), level=data.get('sqlmap_level', 1), risk=data.get('sqlmap_risk', 1))
                structured_data['sqlmap_scan'] = sqlmap_result
                # Count SQL vulnerabilities - check both vulnerabilities list and vulnerable flag
                if isinstance(sqlmap_result, dict):
                    vuln_list = sqlmap_result.get('vulnerabilities', [])
                    is_vulnerable = sqlmap_result.get('vulnerable', False)
                    
                    # If marked as vulnerable but no specific vulns listed, count as 1
                    if is_vulnerable and len(vuln_list) == 0:
                        total_findings += 1
                        logger.info("SQLMap found vulnerability (counted as 1)")
                    else:
                        # Count unique parameter mentions
                        param_count = len([v for v in vuln_list if 'parameter' in v.lower() or 'is vulnerable' in v.lower()])
                        if param_count > 0:
                            total_findings += param_count
                            logger.info(f"SQLMap found {param_count} vulnerable parameters")
            
            if data.get('run_wpscan', False):
                logger.info("🔍 WPScan requested, checking if site is WordPress...")
                
                if is_wordpress_site(target_url):
                    logger.info("✅ WordPress site detected, running WPScan...")
                    wpscan_result = run_wpscan(target_url, enumerate_opt=data.get('wpscan_enumerate', 'vp,vt,u'))
                    structured_data['wpscan_results'] = wpscan_result
                    
                    # Count WordPress vulnerabilities
                    if isinstance(wpscan_result, dict):
                        vuln_count = 0
                        
                        # Check for errors first
                        if 'error' in wpscan_result:
                            logger.warning(f"⚠️ WPScan error: {wpscan_result.get('error')}")
                        
                        # Count vulnerabilities from different sources
                        if 'vulnerabilities' in wpscan_result:
                            vuln_list = wpscan_result['vulnerabilities']
                            if isinstance(vuln_list, list):
                                vuln_count += len(vuln_list)
                                logger.info(f"📊 Found {len(vuln_list)} direct vulnerabilities")
                        
                        if 'interesting_findings' in wpscan_result:
                            findings = wpscan_result['interesting_findings']
                            if isinstance(findings, list):
                                vuln_count += len(findings)
                                logger.info(f"📊 Found {len(findings)} interesting findings")
                        
                        # Count plugin vulnerabilities
                        if 'plugins' in wpscan_result:
                            plugins = wpscan_result['plugins']
                            if isinstance(plugins, dict):
                                for plugin_name, plugin_data in plugins.items():
                                    if isinstance(plugin_data, dict) and 'vulnerabilities' in plugin_data:
                                        plugin_vulns = plugin_data['vulnerabilities']
                                        if isinstance(plugin_vulns, list):
                                            vuln_count += len(plugin_vulns)
                                            logger.info(f"📊 Plugin '{plugin_name}' has {len(plugin_vulns)} vulnerabilities")
                        
                        # Count theme vulnerabilities
                        if 'themes' in wpscan_result:
                            themes = wpscan_result['themes']
                            if isinstance(themes, dict):
                                for theme_name, theme_data in themes.items():
                                    if isinstance(theme_data, dict) and 'vulnerabilities' in theme_data:
                                        theme_vulns = theme_data['vulnerabilities']
                                        if isinstance(theme_vulns, list):
                                            vuln_count += len(theme_vulns)
                                            logger.info(f"📊 Theme '{theme_name}' has {len(theme_vulns)} vulnerabilities")
                        
                        total_findings += vuln_count
                        logger.info(f"✅ WPScan added {vuln_count} findings. Total: {total_findings}")
                else:
                    logger.info("❌ Target is not a WordPress site, skipping WPScan")
                    structured_data['wpscan_results'] = {
                        "skipped": True,
                        "reason": "Not a WordPress site"
                    }

            # OWASP Scanning
            if data.get('run_owasp', False):
                logger.info("🛡️ OWASP scan requested...")
                try:
                    owasp_scanner = OWASPScanner()
                    owasp_result = owasp_scanner.scan_target(target_url, {
                        'active_scan': data.get('owasp_active_scan', True),
                        'spider': data.get('owasp_spider', True),
                        'timeout': data.get('owasp_timeout', 300)
                    })
                    structured_data['owasp_scan'] = owasp_result
                    
                    # Count OWASP vulnerabilities
                    if isinstance(owasp_result, dict):
                        owasp_vuln_count = owasp_result.get('total_vulnerabilities', 0)
                        total_findings += owasp_vuln_count
                        logger.info(f"✅ OWASP scan added {owasp_vuln_count} findings. Total: {total_findings}")
                        
                        # Log risk assessment
                        risk_rating = owasp_result.get('risk_rating', 'UNKNOWN')
                        logger.info(f"🔍 OWASP Risk Rating: {risk_rating}")
                        
                except Exception as owasp_error:
                    logger.error(f"❌ OWASP scan failed: {str(owasp_error)}")
                    structured_data['owasp_scan'] = {
                        "error": str(owasp_error),
                        "scan_completed": False
                    }
        
        except Exception as scan_error:
            logger.error(f"Error in additional scans: {str(scan_error)}")
            structured_data['scan_errors'] = str(scan_error)
        
        # Set the total findings after all scans
        structured_data['total_findings'] = total_findings
        logger.info(f"Vulnerability scan completed successfully. Total findings: {total_findings}")
        return JsonResponse(structured_data)
    
    except Exception as e:
        logger.error(f"Vulnerability scan failed: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

def run_gobuster(url, extensions=None):
    """Run Gobuster against the target URL and parse results"""
    logger.info(f"Running Gobuster for {url}")

    # Create a temporary file to store the results
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        temp_file_path = temp_file.name

    # Define the wordlist path with a smaller, faster list
    wordlist = "/usr/share/wordlists/dirb/common.txt"

    # Run Gobuster command with optimizations
    try:
        cmd = [
            "gobuster", "dir",
            "--url", url,
            "--wordlist", wordlist,
            "--quiet",
            "-k",  # Skip SSL verification
            "-t", "50",  # Increase threads for speed
            "-r",  # Follow redirects
            "--timeout", "30s",  # Add timeout per request
            "--no-error",  # Don't display errors
            "--output", temp_file_path
        ]

        # Optional file extensions to probe (passed as a list arg, safe)
        if extensions:
            cmd += ["-x", extensions]
        
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=600,  # 10-minute timeout
            check=True
        )
        
        # Read the results from the temporary file
        with open(temp_file_path, 'r') as f:
            results = f.read()
        
        # Clean up the temporary file
        os.unlink(temp_file_path)
        
        # Parse the results
        return parse_gobuster_results(results)
    
    except subprocess.CalledProcessError as e:
        logger.error(f"Gobuster scan failed: {e.stderr}")
        # Clean up the temporary file if it exists
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        
        # Return empty results if Gobuster fails
        return {
            "directories": [],
            "files": []
        }
    except Exception as e:
        logger.error(f"Unexpected error in Gobuster: {str(e)}")
        return {
            "directories": [],
            "files": []
        }

def parse_gobuster_results(results):
    """Parse Gobuster output and separate directories from files"""
    directories = []
    files = []
    
    logger.info(f"Parsing Gobuster results, length: {len(results)}")
    
    # Debug: Log first 500 chars of output to see format
    logger.info(f"Gobuster output sample: {results[:500]}")
    
    # More robust regex to handle various Gobuster output formats
    # Matches: path (Status: 200) [Size: 1234]
    # Now matches paths without leading slash too
    pattern = re.compile(r'^([^\s]+)\s+\(Status:\s*(\d+)\)', re.MULTILINE)
    
    matches = list(pattern.finditer(results))
    logger.info(f"Found {len(matches)} matches in Gobuster output")
    
    for match in matches:
        path = match.group(1)
        status = int(match.group(2))
        
        # Ensure path starts with / for consistency
        if not path.startswith('/'):
            path = '/' + path
        
        # Log first few matches for debugging
        if len(directories) + len(files) < 5:
            logger.info(f"Parsed: {path} -> Status {status}")
        
        # Only include successful responses (2xx and 3xx status codes)
        if 200 <= status < 400:
            # Determine if it's a file or directory
            # Check if the last part has a file extension
            last_part = path.rstrip('/').split('/')[-1]
            if '.' in last_part and not last_part.startswith('.'):
                files.append({
                    'path': path,
                    'status': status
                })
            else:
                directories.append({
                    'path': path,
                    'status': status
                })
        else:
            # Log non-2xx/3xx responses for debugging
            if len(directories) + len(files) < 3:
                logger.info(f"Skipping non-success status: {path} (Status: {status})")
    
    logger.info(f"Total parsed: {len(directories)} directories, {len(files)} files")
    
    return {
        "directories": directories,
        "files": files
    }

def run_nikto(url, tuning=None):
    """Run Nikto against the target URL and return results"""
    try:
        # Normalize URL for Nikto - ensure it has protocol
        normalized_url = url
        try_http_fallback = False
        
        if not url.startswith('http://') and not url.startswith('https://'):
            # Check if it's an IP address
            import re
            is_ip = re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$', url)
            
            if is_ip:
                # For IP addresses, use HTTP (most common for IP-based scanning)
                normalized_url = f'http://{url}'
                logger.info(f"Normalized IP to: {normalized_url}")
            else:
                # For domains, try HTTPS first (modern standard)
                normalized_url = f'https://{url}'
                try_http_fallback = True  # Will try HTTP if HTTPS fails
                logger.info(f"Normalized domain to: {normalized_url}")
        
        logger.info(f"Running Nikto scan on {normalized_url}")
        
        # Try to run Nikto
        nikto_result = _execute_nikto(normalized_url, tuning=tuning)

        # If HTTPS failed and we should try HTTP
        if nikto_result.get('error') and try_http_fallback and normalized_url.startswith('https://'):
            logger.warning(f"HTTPS scan failed, trying HTTP fallback...")
            http_url = normalized_url.replace('https://', 'http://')
            nikto_result = _execute_nikto(http_url, tuning=tuning)
        
        return nikto_result
    
    except Exception as e:
        logger.error(f"Nikto scan failed: {str(e)}")
        return {
            "error": str(e),
            "vulnerabilities": []
        }

def _execute_nikto(url, tuning=None):
    """Execute Nikto command and return results"""
    try:
        # Updated Nikto command to include output file
        with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.json') as temp_output:
            cmd = [
                "nikto",
                "-h", url,
                "-Format", "json",
                "-o", temp_output.name,  # Specify output file
                "-timeout", "300",  # 5-minute timeout per request
                "-ssl"  # Enable SSL support (works for both HTTP and HTTPS)
            ]

            # Optional Nikto tuning codes (validated against an allow-list pattern)
            if tuning and re.match(r'^[0-9a-c]+$', str(tuning)):
                cmd += ["-Tuning", tuning]

            logger.info(f"Executing: {' '.join(cmd)}")
            
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=600  # 10 minute total timeout
            )
        
        # Read the output file
        try:
            with open(temp_output.name, 'r') as f:
                nikto_results = json.load(f)
            os.unlink(temp_output.name)  # Delete temp file
            
            # Ensure vulnerabilities field exists
            if 'vulnerabilities' not in nikto_results:
                nikto_results['vulnerabilities'] = []
            
            return nikto_results
        except Exception as file_error:
            logger.warning(f"Failed to parse Nikto JSON output: {file_error}")
            
            # Try to clean up temp file
            try:
                os.unlink(temp_output.name)
            except:
                pass
            
            # Return raw output if JSON parsing fails
            return {
                "raw_output": process.stdout,
                "error": f"JSON parsing failed: {str(file_error)}",
                "vulnerabilities": []
            }
    
    except subprocess.TimeoutExpired:
        logger.error(f"Nikto scan timed out after 10 minutes")
        return {
            "error": "Scan timeout - target may be unreachable or very slow",
            "vulnerabilities": []
        }
    except Exception as e:
        logger.error(f"Nikto execution failed: {str(e)}")
        return {
            "error": str(e),
            "vulnerabilities": []
        }

def run_nmap(domain, arguments=None):
    """Run basic Nmap scan against the domain and return results"""
    try:
        # Default command preserves current behavior exactly.
        cmd = ["nmap", "-sV", "-F", "--open", domain]
        if arguments:
            import shlex
            from vulncraft.security import sanitize_nmap_arguments
            try:
                cmd = ["nmap"] + shlex.split(sanitize_nmap_arguments(arguments)) + ["--open", domain]
            except ValueError as nmap_arg_error:
                logger.warning(f"Invalid nmap_arguments, using default: {nmap_arg_error}")
                cmd = ["nmap", "-sV", "-F", "--open", domain]
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        # Parse Nmap output
        open_ports = []
        current_port = None
        
        for line in process.stdout.splitlines():
            port_match = re.search(r'^(\d+)/(\w+)\s+(\w+)\s+(.*)$', line.strip())
            if port_match:
                port_number, protocol, state, service = port_match.groups()
                current_port = {
                    "port": int(port_number),
                    "protocol": protocol,
                    "state": state,
                    "service": service
                }
                open_ports.append(current_port)
        
        return {
            "open_ports": open_ports,
            "raw_output": process.stdout
        }
    
    except Exception as e:
        return {
            "error": str(e),
            "raw_output": None
        }

def run_sqlmap(url, level=1, risk=1):
    """Run SQLMap against the target URL with comprehensive logging and error handling"""
    try:
        # Clamp to SQLMap's valid ranges (level 1-5, risk 1-3)
        try:
            level = max(1, min(5, int(level)))
        except (TypeError, ValueError):
            level = 1
        try:
            risk = max(1, min(3, int(risk)))
        except (TypeError, ValueError):
            risk = 1
        logger.info(f"🚀 Starting SQLMap scan on {url}")
        
        # First verify SQLMap is installed
        try:
            version_check = subprocess.run(
                ["sqlmap", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10
            )
            logger.info(f"✅ SQLMap installed: {version_check.stdout.strip()[:100]}")
        except Exception as version_error:
            logger.error(f"❌ SQLMap not found or not executable: {version_error}")
            return {
                "error": "SQLMap is not installed or not accessible",
                "details": str(version_error),
                "vulnerabilities": []
            }
        
        # Optimized SQLMap command for faster scanning
        cmd = [
            "sqlmap", 
            "-u", url, 
            "--batch",  # Non-interactive mode
            f"--level={level}",  # Scan level (1-5)
            f"--risk={risk}",  # Scan risk (1-3)
            "--threads=5",  # Use multiple threads
            "--timeout=20",  # Timeout per HTTP request (increased from 10)
            "--retries=2",  # Fewer retries (increased from 1 for reliability)
            "--technique=BEUSTQ",  # All techniques for better detection
            "--output-dir=/tmp/sqlmap",
            "--flush-session",  # Don't use cached data
            "--fresh-queries",  # Don't use cached queries
            "--answers=quit=N,follow=N",  # Auto-answer prompts
            "--random-agent",  # Use random user agent
            "--no-logging"  # Don't create log files
        ]
        
        logger.info(f"📝 SQLMap command: {' '.join(cmd)}")
        logger.info(f"⏳ Executing SQLMap... (this may take up to 10 minutes)")
        
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=600  # 10 minute timeout (increased from 150 seconds)
        )
        
        logger.info(f"📊 SQLMap exit code: {process.returncode}")
        logger.info(f"📊 STDOUT length: {len(process.stdout)} chars")
        logger.info(f"📊 STDERR length: {len(process.stderr)} chars")
        
        # Log preview of output
        if process.stdout:
            logger.debug(f"STDOUT preview (first 500 chars): {process.stdout[:500]}")
        if process.stderr:
            logger.debug(f"STDERR preview (first 500 chars): {process.stderr[:500]}")
        
        # Parse SQLMap output looking for vulnerabilities
        vulnerabilities = []
        injectable_params = []
        injection_points = []
        dbms_info = None
        is_vulnerable = False
        vulnerability_type = None
        
        # Look for SQLi detection in output
        output_lower = process.stdout.lower()
        
        # More comprehensive vulnerability detection
        vulnerability_indicators = {
            "is vulnerable": "SQL Injection Vulnerability",
            "injectable": "Injectable Parameter",
            "parameter appears to be": "Potential SQL Injection",
            "sqlmap identified the following injection point": "Confirmed Injection Point",
            "parameter is vulnerable": "Vulnerable Parameter",
            "got a 302 redirect": "Redirect-based Detection",
            "it looks like the back-end dbms is": "DBMS Detected"
        }
        
        # Check if any vulnerability indicator is present
        for indicator, vuln_type in vulnerability_indicators.items():
            if indicator in output_lower:
                is_vulnerable = True
                vulnerability_type = vuln_type
                logger.info(f"🚨 SQLMap detected: {vuln_type} (indicator: '{indicator}')")
                break
        
        # Parse detailed information
        lines = process.stdout.splitlines()
        for i, line in enumerate(lines):
            line_lower = line.lower()
            line_stripped = line.strip()
            
            # Skip empty lines and SQLMap headers
            if not line_stripped or line_stripped.startswith('['):
                continue
            
            # Capture parameter information
            if "parameter:" in line_lower:
                param_info = line_stripped
                vulnerabilities.append(param_info)
                logger.info(f"🔍 Found parameter: {param_info}")
                
                # Try to get the next few lines for context
                for j in range(1, min(5, len(lines) - i)):
                    next_line = lines[i + j].strip()
                    if next_line and not next_line.startswith('[') and next_line:
                        vulnerabilities.append(f"  {next_line}")
                        logger.debug(f"  Context: {next_line[:100]}")
            
            # Capture injection type
            elif "type:" in line_lower and "injection" in line_lower:
                vulnerabilities.append(line_stripped)
                logger.info(f"🔍 Injection type: {line_stripped}")
            
            # Capture title
            elif "title:" in line_lower:
                vulnerabilities.append(line_stripped)
                logger.info(f"🔍 Vulnerability title: {line_stripped[:100]}")
            
            # Capture payload
            elif "payload:" in line_lower:
                payload = line_stripped[:200]  # Limit payload length
                vulnerabilities.append(payload)
                logger.info(f"🔍 Payload found: {payload[:80]}...")
            
            # Capture "appears to be injectable"
            elif "appears to be" in line_lower and "injectable" in line_lower:
                vulnerabilities.append(line_stripped)
                injection_points.append(line_stripped)
                is_vulnerable = True
                logger.info(f"🚨 Injectable point: {line_stripped}")
            
            # Capture specific parameter mentions
            elif "the following injection point" in line_lower:
                vulnerabilities.append(line_stripped)
                logger.info(f"🎯 Injection point identified: {line_stripped}")
        
        # Extract DBMS information
        if "back-end dbms:" in output_lower:
            for line in lines:
                if "back-end dbms:" in line.lower():
                    dbms_info = line.strip()
                    vulnerabilities.append(f"DBMS: {dbms_info}")
                    logger.info(f"💾 {dbms_info}")
                    break
        
        # Look for "all tested parameters" message
        if "all tested parameters do not appear to be injectable" in output_lower:
            is_vulnerable = False
            logger.info(f"✅ No vulnerabilities found - all parameters tested")
        elif "sqlmap was not able to fingerprint the back-end database" in output_lower and not is_vulnerable:
            logger.info(f"⚠️ SQLMap could not determine if site is vulnerable")
        
        # Create detailed result
        result = {
            "vulnerable": is_vulnerable,
            "vulnerabilities": vulnerabilities,
            "vulnerability_type": vulnerability_type,
            "injection_points": injection_points,
            "dbms": dbms_info,
            "total_findings": len(vulnerabilities) if is_vulnerable else 0,
            "scan_completed": True,
            "raw_output": process.stdout[:8000],  # Increased limit
            "stderr": process.stderr[:2000] if process.stderr else None
        }
        
        if is_vulnerable:
            logger.info(f"✅ SQLMap scan completed - VULNERABLE! Found {len(vulnerabilities)} details")
        else:
            logger.info(f"✅ SQLMap scan completed - No SQL injection vulnerabilities detected")
        
        return result
    
    except subprocess.TimeoutExpired:
        logger.error(f"SQLMap scan timed out after 600 seconds (10 minutes)")
        return {
            "error": "Scan timed out after 10 minutes",
            "vulnerabilities": [],
            "timeout": True
        }
    except Exception as e:
        logger.error(f"SQLMap scan failed: {str(e)}")
        return {
            "error": str(e),
            "vulnerabilities": [],
            "raw_output": None
        }

def is_wordpress_site(url):
    """Check if the site is running WordPress"""
    try:
        logger.info(f"🔍 Checking if {url} is a WordPress site...")
        
        # Check multiple WordPress indicators
        indicators = [
            "/wp-login.php",
            "/wp-admin/",
            "/wp-content/",
            "/wp-includes/"
        ]
        
        for indicator in indicators:
            try:
                cmd = ["curl", "-s", "-L", "-m", "10", f"{url}{indicator}"]
                process = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=15
                )
                
                if "WordPress" in process.stdout or "wp-" in process.stdout:
                    logger.info(f"✅ WordPress detected via {indicator}")
                    return True
            except Exception as check_error:
                logger.debug(f"Failed to check {indicator}: {check_error}")
                continue
        
        logger.info(f"❌ No WordPress indicators found for {url}")
        return False
    except Exception as e:
        logger.error(f"Error checking WordPress site: {str(e)}")
        return False

def run_wpscan(url, enumerate_opt="vp,vt,u"):
    """Run WPScan against the WordPress site with comprehensive error handling and debug logs"""
    try:
        logger.info(f"🚀 Starting WPScan for {url}")

        # Validate enumerate option; fall back to default on anything unexpected.
        if not isinstance(enumerate_opt, str) or not re.match(r'^[a-z,]+$', enumerate_opt):
            enumerate_opt = "vp,vt,u"
        
        # First verify WPScan is installed
        try:
            version_check = subprocess.run(
                ["wpscan", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10
            )
            logger.info(f"✅ WPScan version: {version_check.stdout.strip()}")
        except Exception as version_error:
            logger.error(f"❌ WPScan not found or not executable: {version_error}")
            return {
                "error": "WPScan is not installed or not accessible",
                "details": str(version_error)
            }
        
        # Build WPScan command with comprehensive options
        cmd = [
            "wpscan",
            "--url", url,
            "--format", "json",
            "--no-banner",
            "--random-user-agent",
            "--disable-tls-checks",
            "--enumerate", enumerate_opt,  # Enumerate vulnerable plugins, themes, and users
            "--plugins-detection", "mixed",  # More thorough plugin detection
            "--max-threads", "5",  # Limit threads to avoid overwhelming target
            "--request-timeout", "30",  # Timeout per request
            "--connect-timeout", "30"  # Connection timeout
        ]

        # Add the WPScan API token only if configured (enriches vuln data).
        # Set WPSCAN_API_TOKEN in the environment; never hardcode it.
        wpscan_api_token = os.environ.get("WPSCAN_API_TOKEN")
        if wpscan_api_token:
            cmd += ["--api-token", wpscan_api_token]
        
        logger.info(f"📝 WPScan command: {' '.join(cmd)}")
        
        # Run WPScan
        logger.info("⏳ Executing WPScan... (this may take several minutes)")
        
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=600  # 10 minute timeout
        )
        
        logger.info(f"📊 WPScan exit code: {process.returncode}")
        logger.info(f"📊 STDOUT length: {len(process.stdout)} chars")
        logger.info(f"📊 STDERR length: {len(process.stderr)} chars")
        
        # Log first 500 chars of output for debugging
        if process.stdout:
            logger.debug(f"STDOUT preview: {process.stdout[:500]}")
        if process.stderr:
            logger.debug(f"STDERR preview: {process.stderr[:500]}")
        
        # WPScan returns exit code 0 for success, even with vulnerabilities
        # Non-zero codes typically indicate errors
        if process.returncode != 0:
            logger.warning(f"⚠️ WPScan returned non-zero exit code {process.returncode}")
            if process.stderr:
                logger.warning(f"⚠️ STDERR: {process.stderr[:1000]}")
        
        # Try to parse JSON output
        if process.stdout:
            try:
                wpscan_data = json.loads(process.stdout)
                logger.info(f"✅ Successfully parsed WPScan JSON output")
                
                # Log summary of findings
                if isinstance(wpscan_data, dict):
                    vuln_count = 0
                    
                    if 'interesting_findings' in wpscan_data:
                        vuln_count += len(wpscan_data['interesting_findings'])
                        logger.info(f"🔍 Found {len(wpscan_data['interesting_findings'])} interesting findings")
                    
                    if 'version' in wpscan_data:
                        logger.info(f"🔍 WordPress version: {wpscan_data.get('version', {}).get('number', 'Unknown')}")
                    
                    if 'plugins' in wpscan_data:
                        plugin_count = len(wpscan_data['plugins'])
                        logger.info(f"🔍 Found {plugin_count} plugins")
                        for plugin_name, plugin_data in list(wpscan_data['plugins'].items())[:5]:
                            if isinstance(plugin_data, dict) and plugin_data.get('vulnerabilities'):
                                logger.info(f"  ⚠️ Plugin '{plugin_name}' has vulnerabilities")
                    
                    if 'themes' in wpscan_data:
                        theme_count = len(wpscan_data['themes'])
                        logger.info(f"🔍 Found {theme_count} themes")
                    
                    logger.info(f"✅ WPScan completed successfully with {vuln_count} findings")
                
                return wpscan_data
                
            except json.JSONDecodeError as json_error:
                logger.error(f"❌ Failed to parse WPScan JSON output: {json_error}")
                logger.error(f"Raw output (first 1000 chars): {process.stdout[:1000]}")
                
                return {
                    "error": "Failed to parse WPScan JSON output",
                    "json_error": str(json_error),
                    "raw_output": process.stdout[:5000],  # Limit to 5000 chars
                    "stderr": process.stderr[:5000] if process.stderr else None
                }
        else:
            logger.error("❌ WPScan produced no output")
            return {
                "error": "WPScan produced no output",
                "exit_code": process.returncode,
                "stderr": process.stderr[:5000] if process.stderr else None
            }
    
    except subprocess.TimeoutExpired:
        logger.error(f"❌ WPScan timed out after 10 minutes")
        return {
            "error": "WPScan scan timed out after 10 minutes",
            "timeout": True
        }
    except Exception as e:
        logger.error(f"❌ WPScan failed with exception: {str(e)}")
        logger.exception("Full exception details:")
        return {
            "error": str(e),
            "exception_type": type(e).__name__,
            "raw_output": None
        }


@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def owasp_scan(request):
    """
    Dedicated OWASP security scan endpoint
    """
    try:
        data = json.loads(request.body)
        target_url = data.get('url')
        
        # Validate URL
        if not target_url:
            return JsonResponse({'error': 'URL is required'}, status=400)
        
        # Ensure URL has a scheme
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url

        try:
            validate_scan_target(target_url)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)

        logger.info(f"🛡️ Starting dedicated OWASP scan for {target_url}")
        
        # Initialize OWASP scanner
        owasp_scanner = OWASPScanner()
        
        # Configure scan options
        scan_options = {
            'active_scan': data.get('active_scan', True),
            'spider': data.get('spider', True),
            'timeout': data.get('timeout', 300),
            'zap_baseline': data.get('zap_baseline', False),
            'owasp_top10_check': data.get('owasp_top10_check', True),
            'security_headers_check': data.get('security_headers_check', True),
            'ssl_tls_check': data.get('ssl_tls_check', True)
        }
        
        # Run comprehensive OWASP scan
        scan_result = owasp_scanner.scan_target(target_url, scan_options)
        
        # Add metadata
        scan_result['scan_type'] = 'owasp_comprehensive'
        scan_result['scan_options'] = scan_options
        scan_result['total_findings'] = scan_result.get('total_vulnerabilities', 0)
        
        logger.info(f"✅ OWASP scan completed. Found {scan_result['total_findings']} vulnerabilities with {scan_result.get('risk_rating', 'UNKNOWN')} risk rating")
        
        return JsonResponse(scan_result)
        
    except Exception as e:
        logger.error(f"❌ OWASP scan failed: {str(e)}")
        return JsonResponse({
            'error': str(e),
            'scan_type': 'owasp_comprehensive',
            'scan_status': 'failed'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def owasp_zap_baseline(request):
    """
    OWASP ZAP Baseline scan endpoint (faster scan)
    """
    try:
        data = json.loads(request.body)
        target_url = data.get('url')
        
        if not target_url:
            return JsonResponse({'error': 'URL is required'}, status=400)
        
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url

        try:
            validate_scan_target(target_url)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)

        logger.info(f"⚡ Starting OWASP ZAP baseline scan for {target_url}")
        
        owasp_scanner = OWASPScanner()
        
        # Run baseline scan (passive only)
        scan_options = {
            'active_scan': False,
            'spider': True,
            'timeout': 120,  # 2 minutes for baseline
            'baseline_scan': True
        }
        
        scan_result = owasp_scanner.scan_target(target_url, scan_options)
        scan_result['scan_type'] = 'owasp_baseline'
        scan_result['total_findings'] = scan_result.get('total_vulnerabilities', 0)
        
        logger.info(f"✅ OWASP baseline scan completed. Found {scan_result['total_findings']} issues")
        
        return JsonResponse(scan_result)
        
    except Exception as e:
        logger.error(f"❌ OWASP baseline scan failed: {str(e)}")
        return JsonResponse({
            'error': str(e),
            'scan_type': 'owasp_baseline',
            'scan_status': 'failed'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def owasp_dependency_check(request):
    """
    OWASP Dependency Check endpoint
    """
    try:
        data = json.loads(request.body)
        project_path = data.get('project_path', '/app')  # Default to app directory
        
        logger.info(f"🔍 Starting OWASP Dependency Check for {project_path}")
        
        owasp_scanner = OWASPScanner()
        dependency_result = owasp_scanner.run_dependency_check(project_path)
        
        dependency_result['scan_type'] = 'owasp_dependency_check'
        dependency_result['project_path'] = project_path
        
        logger.info(f"✅ Dependency check completed")
        
        return JsonResponse(dependency_result)
        
    except Exception as e:
        logger.error(f"❌ OWASP dependency check failed: {str(e)}")
        return JsonResponse({
            'error': str(e),
            'scan_type': 'owasp_dependency_check',
            'scan_status': 'failed'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def web_hygiene_scan(request):
    """Web Hygiene scan: security headers, TLS, cookies, CORS, exposed files.
    Fast, dependency-free checks that find real issues on modern sites."""
    try:
        data = json.loads(request.body)
        target_url = data.get('url')
        if not target_url:
            return JsonResponse({'error': 'URL is required'}, status=400)
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url
        try:
            validate_scan_target(target_url)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)

        from .services.web_hygiene import run_web_hygiene
        check_exposed_paths = data.get('check_exposed_paths', True)
        logger.info(f"🧼 Starting web hygiene scan for {target_url}")
        result = run_web_hygiene(target_url, check_exposed_paths=check_exposed_paths)
        result['scan_type'] = 'web_hygiene'
        result['total_findings'] = len(result.get('findings', []))
        logger.info(f"✅ Web hygiene scan completed: {result.get('summary')}")
        return JsonResponse(result)
    except Exception as e:
        logger.error(f"❌ Web hygiene scan failed: {str(e)}")
        return JsonResponse({'error': str(e), 'scan_type': 'web_hygiene',
                             'scan_status': 'failed'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def nuclei_scan(request):
    """Nuclei template-based scan (CVEs, exposures, misconfigurations)."""
    try:
        data = json.loads(request.body)
        target_url = data.get('url')
        if not target_url:
            return JsonResponse({'error': 'URL is required'}, status=400)
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url
        try:
            validate_scan_target(target_url)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)

        from .services.nuclei_runner import run_nuclei
        severity = data.get('severity', 'low,medium,high,critical')
        timeout = int(data.get('timeout', 240))
        logger.info(f"☢️ Starting nuclei scan for {target_url}")
        result = run_nuclei(target_url, severity=severity, timeout=timeout)
        result['scan_type'] = 'nuclei'
        result['total_findings'] = len(result.get('findings', []))
        logger.info(f"✅ Nuclei scan completed: {result.get('summary')}")
        return JsonResponse(result)
    except Exception as e:
        logger.error(f"❌ Nuclei scan failed: {str(e)}")
        return JsonResponse({'error': str(e), 'scan_type': 'nuclei',
                             'scan_status': 'failed'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def js_recon_scan(request):
    """JS/endpoint recon: parse the SPA's JavaScript for API endpoints,
    URLs, and leaked secrets — the real attack surface on modern sites."""
    try:
        data = json.loads(request.body)
        target_url = data.get('url')
        if not target_url:
            return JsonResponse({'error': 'URL is required'}, status=400)
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url
        try:
            validate_scan_target(target_url)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)

        from .services.js_recon import run_js_recon
        logger.info(f"🔎 Starting JS recon for {target_url}")
        result = run_js_recon(target_url)
        result['scan_type'] = 'js-recon'
        result['total_findings'] = len(result.get('findings', []))
        logger.info(f"✅ JS recon completed: {result.get('summary')}")
        return JsonResponse(result)
    except Exception as e:
        logger.error(f"❌ JS recon failed: {str(e)}")
        return JsonResponse({'error': str(e), 'scan_type': 'js-recon',
                             'scan_status': 'failed'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_scanner_secret
def code_scan(request):
    """SAST + secrets + dependency audit on a repo's source (no deploy needed).
    Clones the repo and runs Semgrep, gitleaks, and osv-scanner."""
    try:
        data = json.loads(request.body)
        owner = data.get('owner')
        repo = data.get('repo')
        if not owner or not repo:
            return JsonResponse({'error': 'owner and repo are required'}, status=400)
        # Validate to prevent argument injection into the git clone command.
        if not re.match(r'^[A-Za-z0-9_.-]+$', owner) or not re.match(r'^[A-Za-z0-9_.-]+$', repo):
            return JsonResponse({'error': 'invalid owner/repo'}, status=400)
        branch = data.get('branch')
        if branch and not re.match(r'^[A-Za-z0-9_./-]+$', branch):
            branch = None

        from .services.code_scan import run_code_scan
        logger.info(f"🧬 Code scan for {owner}/{repo}")
        result = run_code_scan(owner, repo, token=data.get('token'), branch=branch)
        result['scan_type'] = 'code-scan'
        result['total_findings'] = len(result.get('findings', []))
        logger.info(f"✅ Code scan completed: {result.get('summary')}")
        return JsonResponse(result)
    except Exception as e:
        logger.error(f"❌ Code scan failed: {str(e)}")
        return JsonResponse({'error': str(e), 'scan_type': 'code-scan',
                             'scan_status': 'failed'}, status=500)