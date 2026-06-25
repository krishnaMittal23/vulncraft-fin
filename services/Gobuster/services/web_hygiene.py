"""Web Hygiene scanner.

Lightweight, dependency-free HTTP/TLS posture checks that find real issues on
modern sites (SPAs behind a CDN/WAF) where dir-brute / port tools come up empty:
security headers, TLS/cert health, cookie flags, permissive CORS, and exposed
sensitive files (.git, .env, source maps, backups). Pure `requests` + stdlib ssl.
"""
import logging
import socket
import ssl
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests

logger = logging.getLogger(__name__)

# Keep scans quick and polite — this node is meant to be fast.
_TIMEOUT = 10
_UA = "VulnCraft-WebHygiene/1.0"

# Security response headers we expect on a hardened site.
_SECURITY_HEADERS = {
    "strict-transport-security": ("HTTP Strict Transport Security (HSTS)", "MEDIUM"),
    "content-security-policy": ("Content Security Policy", "MEDIUM"),
    "x-frame-options": ("Clickjacking protection", "LOW"),
    "x-content-type-options": ("MIME-sniffing protection", "LOW"),
    "referrer-policy": ("Referrer policy", "LOW"),
    "permissions-policy": ("Permissions policy", "LOW"),
}

# Sensitive paths that should never be publicly served. Small, high-signal list.
_EXPOSED_PATHS = [
    ("/.git/HEAD", "Exposed .git repository", "HIGH"),
    ("/.git/config", "Exposed .git config", "HIGH"),
    ("/.env", "Exposed .env (secrets likely)", "HIGH"),
    ("/.env.local", "Exposed .env.local", "HIGH"),
    ("/config.json", "Exposed config.json", "MEDIUM"),
    ("/.DS_Store", "Exposed .DS_Store (dir listing)", "LOW"),
    ("/.svn/entries", "Exposed .svn metadata", "MEDIUM"),
    ("/server-status", "Exposed Apache server-status", "MEDIUM"),
    ("/phpinfo.php", "Exposed phpinfo()", "MEDIUM"),
    ("/.aws/credentials", "Exposed AWS credentials", "HIGH"),
    ("/backup.zip", "Exposed backup archive", "MEDIUM"),
]


def _session():
    s = requests.Session()
    s.headers.update({"User-Agent": _UA})
    s.max_redirects = 5
    return s


def _check_tls(hostname, port):
    """Return TLS posture: protocol, cipher, cert expiry, and any findings."""
    findings = []
    info = {}
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=_TIMEOUT) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                protocol = ssock.version()
                cipher = ssock.cipher()
        info["protocol"] = protocol
        info["cipher_suite"] = cipher[0] if cipher else None
        not_after = cert.get("notAfter")
        info["certificate_not_after"] = not_after
        info["certificate_subject"] = dict(x[0] for x in cert.get("subject", []))
        info["certificate_issuer"] = dict(x[0] for x in cert.get("issuer", []))

        if protocol in ("TLSv1", "TLSv1.1", "SSLv3"):
            findings.append(_finding(
                f"Weak TLS protocol: {protocol}", "HIGH",
                f"Server negotiated {protocol}, which is deprecated and insecure.",
                "Disable TLS 1.0/1.1 and require TLS 1.2 or 1.3.",
            ))

        if not_after:
            try:
                exp = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                days = (exp - datetime.now(timezone.utc)).days
                info["certificate_days_remaining"] = days
                if days < 0:
                    findings.append(_finding(
                        "Expired TLS certificate", "HIGH",
                        f"The certificate expired {abs(days)} day(s) ago.",
                        "Renew the certificate immediately.",
                    ))
                elif days < 15:
                    findings.append(_finding(
                        "TLS certificate expiring soon", "MEDIUM",
                        f"The certificate expires in {days} day(s).",
                        "Renew the certificate before it expires.",
                    ))
            except ValueError:
                pass
    except ssl.SSLError as e:
        findings.append(_finding(
            "TLS handshake / certificate error", "HIGH",
            f"TLS error connecting to {hostname}:{port}: {e}",
            "Fix the certificate chain / TLS configuration.",
        ))
        info["error"] = str(e)
    except (socket.timeout, socket.gaierror, OSError) as e:
        info["error"] = str(e)
    return info, findings


def _check_cookies(resp):
    findings = []
    cookies = []
    for raw in resp.raw.headers.getlist("Set-Cookie") if hasattr(resp.raw, "headers") else []:
        low = raw.lower()
        name = raw.split("=", 1)[0].strip()
        flags = {
            "secure": "secure" in low,
            "httponly": "httponly" in low,
            "samesite": "samesite" in low,
        }
        cookies.append({"name": name, **flags})
        missing = [f for f in ("secure", "httponly", "samesite") if not flags[f]]
        if missing:
            findings.append(_finding(
                f"Cookie '{name}' missing {', '.join(missing)} flag(s)", "LOW",
                f"Set-Cookie for '{name}' is missing: {', '.join(missing)}.",
                "Set Secure, HttpOnly, and SameSite on session cookies.",
            ))
    return cookies, findings


def _check_cors(session, url):
    """Probe for a reflected/permissive CORS policy."""
    findings = []
    info = {}
    try:
        evil = "https://vulncraft-cors-probe.example"
        r = session.get(url, headers={"Origin": evil}, timeout=_TIMEOUT, verify=False)
        acao = r.headers.get("Access-Control-Allow-Origin")
        acac = r.headers.get("Access-Control-Allow-Credentials")
        info = {"access_control_allow_origin": acao, "access_control_allow_credentials": acac}
        if acao == evil and (acac or "").lower() == "true":
            findings.append(_finding(
                "Reflected CORS origin with credentials", "HIGH",
                "Server reflects an arbitrary Origin and allows credentials, "
                "letting any site read authenticated responses.",
                "Allow-list trusted origins; never reflect Origin with Allow-Credentials: true.",
            ))
        elif acao == "*" and (acac or "").lower() == "true":
            findings.append(_finding(
                "Wildcard CORS with credentials", "MEDIUM",
                "Access-Control-Allow-Origin: * combined with credentials.",
                "Do not combine wildcard origin with credentialed CORS.",
            ))
        elif acao == evil:
            findings.append(_finding(
                "Reflected CORS origin", "LOW",
                "Server reflects an arbitrary Origin in Access-Control-Allow-Origin.",
                "Allow-list trusted origins instead of reflecting the request Origin.",
            ))
    except requests.RequestException:
        pass
    return info, findings


def _check_exposed_paths(session, base):
    findings = []
    checked = []
    for path, title, severity in _EXPOSED_PATHS:
        target = urljoin(base, path)
        try:
            r = session.get(target, timeout=_TIMEOUT, verify=False, allow_redirects=False)
        except requests.RequestException:
            continue
        # Treat as exposed only on 200 with non-trivial, non-HTML body
        ctype = r.headers.get("Content-Type", "")
        looks_html = "text/html" in ctype.lower()
        if r.status_code == 200 and len(r.content) > 0 and not looks_html:
            checked.append({"path": path, "status": r.status_code})
            findings.append(_finding(
                title, severity,
                f"{path} is publicly accessible (HTTP 200, {len(r.content)} bytes).",
                f"Block access to {path} at the web server / CDN.",
                evidence=target,
            ))
    return checked, findings


def _check_sourcemaps(session, base, html):
    """Flag JS source maps referenced in the homepage HTML."""
    findings = []
    if "sourcemappingurl" in html.lower():
        findings.append(_finding(
            "JavaScript source map referenced", "LOW",
            "The page references a //# sourceMappingURL, which can expose original source.",
            "Strip source maps from production builds or restrict their access.",
        ))
    return findings


def _finding(title, severity, description, recommendation, evidence=None):
    f = {"title": title, "severity": severity, "description": description,
         "recommendation": recommendation}
    if evidence:
        f["evidence"] = evidence
    return f


def _overall_risk(findings):
    sev = {f["severity"] for f in findings}
    if "HIGH" in sev:
        return "HIGH"
    if "MEDIUM" in sev:
        return "MEDIUM"
    if "LOW" in sev:
        return "LOW"
    return "LOW"


def run_web_hygiene(url, check_exposed_paths=True):
    """Run all web-hygiene checks against `url` and return a structured report."""
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    parsed = urlparse(url)
    hostname = parsed.hostname
    is_https = parsed.scheme == "https"
    session = _session()
    findings = []

    # 1. Fetch the homepage.
    try:
        resp = session.get(url, timeout=_TIMEOUT, verify=False, allow_redirects=True)
    except requests.RequestException as e:
        return {
            "summary": f"Could not reach target: {e}",
            "scan_completed": False,
            "error": str(e),
            "findings": [],
            "overallRisk": "LOW",
        }

    final_url = resp.url
    headers = {k.lower(): v for k, v in resp.headers.items()}

    # 2. Security headers.
    present, missing = {}, {}
    for h, (desc, sev) in _SECURITY_HEADERS.items():
        if h in headers:
            present[h] = headers[h]
        else:
            missing[h] = desc
            # HSTS only matters over https
            if h == "strict-transport-security" and not is_https:
                continue
            findings.append(_finding(
                f"Missing {h} header", sev,
                f"{desc} ({h}) is not set.",
                f"Add the {h} response header.",
            ))

    # 3. Server / tech disclosure.
    server = headers.get("server")
    powered = headers.get("x-powered-by")
    if powered:
        findings.append(_finding(
            "Technology disclosure via X-Powered-By", "LOW",
            f"X-Powered-By reveals: {powered}",
            "Remove the X-Powered-By header.",
        ))

    # 4. HTTP -> HTTPS redirect.
    if parsed.scheme == "http":
        if not (urlparse(final_url).scheme == "https"):
            findings.append(_finding(
                "No HTTP-to-HTTPS redirect", "MEDIUM",
                "Plain HTTP is served without redirecting to HTTPS.",
                "Redirect all HTTP traffic to HTTPS and enable HSTS.",
            ))

    # 5. TLS posture (https only).
    tls = {}
    if is_https and hostname:
        tls, tls_findings = _check_tls(hostname, parsed.port or 443)
        findings.extend(tls_findings)

    # 6. Cookies.
    cookies, cookie_findings = _check_cookies(resp)
    findings.extend(cookie_findings)

    # 7. CORS.
    cors, cors_findings = _check_cors(session, final_url)
    findings.extend(cors_findings)

    # 8. Source maps.
    try:
        findings.extend(_check_sourcemaps(session, final_url, resp.text[:200000]))
    except Exception:
        pass

    # 9. Exposed sensitive files (optional).
    exposed = []
    if check_exposed_paths:
        exposed, exposed_findings = _check_exposed_paths(session, final_url)
        findings.extend(exposed_findings)

    counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    return {
        "scan_completed": True,
        "target_url": url,
        "final_url": final_url,
        "status_code": resp.status_code,
        "server": server,
        "summary": (
            f"{len(findings)} issue(s): {counts['HIGH']} high, "
            f"{counts['MEDIUM']} medium, {counts['LOW']} low."
        ),
        "security_headers": {"present": present, "missing": missing},
        "tls": tls,
        "cookies": cookies,
        "cors": cors,
        "exposed_paths": exposed,
        "findings": findings,
        "finding_counts": counts,
        "overallRisk": _overall_risk(findings),
    }
