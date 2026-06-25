"""Shared security helpers for the scanning service: caller authentication,
SSRF target validation, and nmap argument allow-listing."""
import hmac
import ipaddress
import re
import shlex
import socket
from functools import wraps
from urllib.parse import urlparse

from django.conf import settings
from django.http import JsonResponse


def require_scanner_secret(view_func):
    """Reject scan requests that don't carry the shared secret the Node
    backend signs every internal call with. Fails closed when unconfigured."""
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        configured = getattr(settings, "SCANNER_SHARED_SECRET", "") or ""
        if not configured:
            return JsonResponse(
                {"error": "Scanner authentication is not configured"}, status=503
            )
        provided = request.META.get("HTTP_X_SCANNER_SECRET", "")
        if not provided or not hmac.compare_digest(str(provided), str(configured)):
            return JsonResponse({"error": "Unauthorized"}, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped


# Nmap flags callers may pass. Anything else is rejected so the free-form
# `arguments` field can't smuggle -oN file writes, --script execution, etc.
_ALLOWED_NMAP_FLAGS = {
    "-sS", "-sT", "-sU", "-sN", "-sF", "-sX", "-sA", "-sW", "-sM",
    "-Pn", "-PS", "-PA", "-PU", "-PY", "-PE", "-PP", "-PM", "-sn",
    "-T0", "-T1", "-T2", "-T3", "-T4", "-T5",
    "-F", "-O", "-sV", "-sC", "--traceroute", "-A", "-v", "-vv", "--open",
}
_PORT_VALUE_RE = re.compile(r"^[0-9,\-]+$")


def sanitize_nmap_arguments(arguments):
    """Return a safe nmap argument string built only from an allow-list.
    Raises ValueError on any disallowed token."""
    if not arguments:
        return "-F"
    tokens = shlex.split(str(arguments))
    safe = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok in _ALLOWED_NMAP_FLAGS:
            safe.append(tok)
        elif tok == "-p":
            if i + 1 >= len(tokens) or not _PORT_VALUE_RE.match(tokens[i + 1]):
                raise ValueError("Invalid -p port specification")
            safe.append(tok)
            safe.append(tokens[i + 1])
            i += 1
        elif tok.startswith("-p") and _PORT_VALUE_RE.match(tok[2:]):
            safe.append(tok)
        else:
            raise ValueError(f"Disallowed nmap argument: {tok}")
        i += 1
    return " ".join(safe) if safe else "-F"


def _is_blocked_ip(ip):
    addr = ipaddress.ip_address(ip)
    return (
        addr.is_private or addr.is_loopback or addr.is_link_local
        or addr.is_multicast or addr.is_reserved or addr.is_unspecified
    )


def validate_scan_target(target):
    """Resolve `target` (URL or host[:port]) and ensure it does not point at a
    private / loopback / link-local / metadata (169.254.169.254) address.
    Returns the hostname on success; raises ValueError otherwise. Set
    ALLOW_PRIVATE_SCAN_TARGETS=True to bypass (local testing only)."""
    if getattr(settings, "ALLOW_PRIVATE_SCAN_TARGETS", False):
        return target
    if not target:
        raise ValueError("Target is required")
    candidate = str(target).strip()
    if "://" not in candidate:
        candidate = "http://" + candidate
    host = urlparse(candidate).hostname
    if not host:
        raise ValueError("Could not parse target host")
    # Literal IP?
    try:
        ipaddress.ip_address(host)
        if _is_blocked_ip(host):
            raise ValueError("Target resolves to a disallowed (internal) address")
        return host
    except ValueError as e:
        if "disallowed" in str(e):
            raise
        # not a literal IP -> resolve below
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise ValueError("Target hostname could not be resolved")
    for info in infos:
        if _is_blocked_ip(info[4][0]):
            raise ValueError("Target resolves to a disallowed (internal) address")
    return host
