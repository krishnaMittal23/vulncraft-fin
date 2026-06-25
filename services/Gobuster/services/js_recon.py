"""JS / endpoint recon for modern single-page apps.

Modern sites serve one JS bundle from `/` and leak little to dir-brute/port
scans. This fetches the page + its JavaScript and extracts the app's real
attack surface: API endpoints, absolute URLs, and likely-leaked secrets
(API keys, tokens, private keys) shipped in client-side JS.
"""
import logging
import re
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)

_TIMEOUT = 12
_UA = "VulnCraft-JSRecon/1.0"
_MAX_SCRIPTS = 25
_MAX_JS_BYTES = 2_000_000

# (label, pattern, severity) — high-signal secrets that should never ship in JS.
_SECRET_PATTERNS = [
    ("AWS access key", r"AKIA[0-9A-Z]{16}", "HIGH"),
    ("Google API key", r"AIza[0-9A-Za-z_\-]{35}", "HIGH"),
    ("Slack token", r"xox[baprs]-[0-9A-Za-z\-]{10,48}", "HIGH"),
    ("Stripe live key", r"sk_live_[0-9A-Za-z]{20,}", "HIGH"),
    ("GitHub token", r"gh[pousr]_[0-9A-Za-z]{36,}", "HIGH"),
    ("Private key block", r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----", "HIGH"),
    ("Generic secret assignment", r"(?i)(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*['\"][0-9A-Za-z_\-]{16,}['\"]", "MEDIUM"),
    ("Bearer token", r"(?i)bearer\s+[0-9A-Za-z_\-\.]{20,}", "MEDIUM"),
    ("JWT", r"eyJ[0-9A-Za-z_\-]{8,}\.eyJ[0-9A-Za-z_\-]{8,}\.[0-9A-Za-z_\-]{8,}", "MEDIUM"),
]

_ENDPOINT_RE = re.compile(
    r"""['"`](/(?:api|v[0-9]|graphql|rest|auth|admin|internal|account|users?)[A-Za-z0-9_\-/\.{}:]*)['"`]"""
)
_URL_RE = re.compile(r"""https?://[A-Za-z0-9\-\._~:/?#\[\]@!$&'()*+,;=%]+""")
_SCRIPT_SRC_RE = re.compile(r"""<script[^>]+src=['"]([^'"]+)['"]""", re.I)

# Paths that, if reachable without auth, are high-severity.
_SENSITIVE_RE = re.compile(
    r"(?i)(admin|internal|config|secret|debug|backup|password|token|/users?|/account|private|credential|/env|/key)"
)
_MAX_PROBE = 25


def _normalize_path(ep):
    """Make a discovered endpoint probeable: fill in path params."""
    ep = re.sub(r"\{[^}]*\}", "1", ep)   # /users/{id} -> /users/1
    ep = re.sub(r":[A-Za-z_][A-Za-z0-9_]*", "1", ep)  # /users/:id -> /users/1
    return ep


def _probe_unauthenticated(session, base, endpoints):
    """GET each discovered endpoint with NO auth and flag any that respond 2xx
    (potential missing authentication / broken access control). 401/403 = good."""
    findings, tested = [], []
    accessible = protected = 0
    for ep in endpoints[:_MAX_PROBE]:
        target = urljoin(base, _normalize_path(ep))
        try:
            r = session.get(target, timeout=8, verify=False, allow_redirects=False)
        except requests.RequestException:
            continue
        code = r.status_code
        tested.append({"endpoint": ep, "status": code})
        if code in (401, 403):
            protected += 1
            continue
        if 200 <= code < 300:
            accessible += 1
            ctype = r.headers.get("Content-Type", "").lower()
            is_data = "json" in ctype or "xml" in ctype
            if _SENSITIVE_RE.search(ep):
                sev = "HIGH"
            elif is_data:
                sev = "MEDIUM"
            else:
                sev = "LOW"
            findings.append({
                "severity": sev,
                "title": f"Endpoint reachable without authentication: {ep} (HTTP {code})",
                "category": "broken-access-control",
                "location": target,
                "evidence": f"{code} {ctype or ''}".strip(),
                "recommendation": "Require authentication/authorization on this endpoint, or confirm it is intentionally public.",
            })
    return findings, {"tested": len(tested), "accessible_without_auth": accessible, "protected": protected}


def run_js_recon(url, probe=True):
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    s = requests.Session()
    s.headers.update({"User-Agent": _UA})

    try:
        r = s.get(url, timeout=_TIMEOUT, verify=False, allow_redirects=True)
    except requests.RequestException as e:
        return {"scan_completed": False, "error": str(e),
                "summary": f"Could not reach target: {e}", "findings": [], "overallRisk": "LOW"}

    html = r.text or ""
    scripts, bodies = [], [html]
    for src in _SCRIPT_SRC_RE.findall(html)[:_MAX_SCRIPTS]:
        ju = urljoin(r.url, src)
        scripts.append(ju)
        try:
            jr = s.get(ju, timeout=_TIMEOUT, verify=False)
            if jr.status_code == 200 and len(jr.content) <= _MAX_JS_BYTES:
                bodies.append(jr.text)
        except requests.RequestException:
            continue

    blob = "\n".join(bodies)
    endpoints = sorted({m for m in _ENDPOINT_RE.findall(blob)})[:200]
    urls = sorted({m for m in _URL_RE.findall(blob)})[:100]

    findings = []
    secrets = []
    seen_secret = set()
    for label, pattern, sev in _SECRET_PATTERNS:
        if re.search(pattern, blob):
            if label in seen_secret:
                continue
            seen_secret.add(label)
            secrets.append({"type": label, "severity": sev})
            findings.append({
                "severity": sev,
                "title": f"Possible leaked secret in JS: {label}",
                "category": "secret-exposure",
                "location": scripts[0] if scripts else url,
                "recommendation": "Rotate the secret immediately and never ship secrets in client-side JavaScript; move them server-side.",
            })

    if endpoints:
        findings.append({
            "severity": "low",
            "title": f"{len(endpoints)} API endpoint(s) discovered in JavaScript",
            "category": "attack-surface",
            "location": url,
            "evidence": ", ".join(endpoints[:12]),
            "recommendation": "Review these endpoints for authentication/authorization; they are the app's real attack surface for further testing.",
        })

    # Probe the discovered endpoints WITHOUT auth → flag any that respond 2xx
    # (potential missing authentication / broken access control).
    endpoint_auth = None
    if probe and endpoints:
        auth_findings, endpoint_auth = _probe_unauthenticated(s, r.url, endpoints)
        findings.extend(auth_findings)

    counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for f in findings:
        counts[f["severity"].upper()] = counts.get(f["severity"].upper(), 0) + 1
    overall = "HIGH" if counts["HIGH"] else "MEDIUM" if counts["MEDIUM"] else "LOW"

    return {
        "scan_completed": True,
        "target_url": url,
        "scripts_analyzed": len(scripts),
        "scripts": scripts,
        "endpoints": endpoints,
        "urls": urls,
        "secrets_found": len(secrets),
        "endpoint_auth": endpoint_auth,
        "findings": findings,
        "summary": (
            f"{len(scripts)} script(s) · {len(endpoints)} endpoint(s) · {len(secrets)} secret(s)"
            + (f" · {endpoint_auth['accessible_without_auth']}/{endpoint_auth['tested']} endpoints reachable WITHOUT auth"
               if endpoint_auth else "")
        ),
        "overallRisk": overall,
    }
