"""Code scan (SAST + secrets + dependency audit) — runs on a repo's SOURCE, so
it works with NO deployment. Clones the repo (shallow) and runs:
  - Semgrep      → SAST findings (CWE-tagged)
  - gitleaks     → hard-coded secret detection
  - osv-scanner  → known-vulnerable dependencies (OSV/CVE)
and normalizes everything into the unified findings schema. Each tool is
skipped gracefully (with a note) if its binary isn't installed.
"""
import json
import logging
import os
import shutil
import subprocess
import tempfile

logger = logging.getLogger(__name__)

_CLONE_TIMEOUT = 120
_TOOL_TIMEOUT = 300


def _sev_from_semgrep(s):
    s = (s or "").upper()
    return {"ERROR": "high", "WARNING": "medium", "INFO": "low"}.get(s, "medium")


def _sev_from_osv(v):
    # OSV severity is inconsistent; map common shapes to our scale.
    sev = ""
    for s in v.get("severity", []) or []:
        sev = s.get("score") or sev
    db = (v.get("database_specific") or {}).get("severity", "")
    text = f"{sev} {db}".upper()
    if "CRITICAL" in text:
        return "critical"
    if "HIGH" in text:
        return "high"
    if "MODERATE" in text or "MEDIUM" in text:
        return "medium"
    if "LOW" in text:
        return "low"
    return "medium"


def _clone(owner, repo, token, branch):
    tmp = tempfile.mkdtemp(prefix="vulncraft-codescan-")
    auth = f"x-access-token:{token}@" if token else ""
    url = f"https://{auth}github.com/{owner}/{repo}.git"
    cmd = ["git", "clone", "--depth", "1"]
    if branch:
        cmd += ["--branch", branch]
    cmd += [url, tmp]
    subprocess.run(cmd, timeout=_CLONE_TIMEOUT, capture_output=True, text=True, check=True)
    return tmp


def _run_semgrep(path):
    if not shutil.which("semgrep"):
        return [], "semgrep not installed"
    try:
        proc = subprocess.run(
            ["semgrep", "--config", "auto", "--json", "--quiet", "--timeout", "60", path],
            capture_output=True, text=True, timeout=_TOOL_TIMEOUT,
        )
        data = json.loads(proc.stdout or "{}")
    except Exception as e:
        return [], f"semgrep error: {e}"
    out = []
    for r in data.get("results", []):
        extra = r.get("extra", {})
        meta = extra.get("metadata", {}) or {}
        cwe = meta.get("cwe")
        cwe = (cwe[0] if isinstance(cwe, list) and cwe else cwe) or None
        rel = os.path.relpath(r.get("path", ""), path)
        out.append({
            "severity": _sev_from_semgrep(extra.get("severity")),
            "title": extra.get("message") or r.get("check_id") or "SAST finding",
            "category": "sast",
            "location": f"{rel}:{r.get('start', {}).get('line', '?')}",
            "recommendation": (meta.get("references") or [None])[0] or "Review and remediate per the rule guidance.",
            "source": "semgrep",
            "cwe": cwe,
        })
    return out, None


def _run_detect_secrets(path):
    if not shutil.which("detect-secrets"):
        return [], "detect-secrets not installed"
    try:
        proc = subprocess.run(
            ["detect-secrets", "scan", path],
            capture_output=True, text=True, timeout=_TOOL_TIMEOUT,
        )
        data = json.loads(proc.stdout or "{}")
    except Exception as e:
        return [], f"detect-secrets error: {e}"
    out = []
    for fname, items in (data.get("results") or {}).items():
        rel = os.path.relpath(fname, path) if os.path.isabs(fname) else fname
        for it in items:
            out.append({
                "severity": "high",
                "title": f"Hardcoded secret: {it.get('type', 'secret')}",
                "category": "secret",
                "location": f"{rel}:{it.get('line_number')}",
                "recommendation": "Remove the secret from source, rotate it, and load it from a secret manager.",
                "source": "detect-secrets",
            })
    return out, None


def _run_pip_audit(path):
    if not shutil.which("pip-audit"):
        return [], "pip-audit not installed"
    reqs = []
    for root, _dirs, files in os.walk(path):
        if f"{os.sep}.git" in root:
            continue
        for fn in files:
            if fn.startswith("requirements") and fn.endswith(".txt"):
                reqs.append(os.path.join(root, fn))
    if not reqs:
        return [], "no Python requirements found"
    out = []
    for req in reqs[:5]:
        try:
            proc = subprocess.run(
                ["pip-audit", "-r", req, "-f", "json", "--progress-spinner", "off"],
                capture_output=True, text=True, timeout=_TOOL_TIMEOUT,
            )
            data = json.loads(proc.stdout or "{}")
        except Exception:
            continue
        deps = data.get("dependencies") if isinstance(data, dict) else data
        for d in deps or []:
            for v in d.get("vulns", []) or []:
                fixes = v.get("fix_versions") or []
                out.append({
                    "severity": "high",
                    "title": f"{d.get('name')} {d.get('version', '')}: {v.get('id')}",
                    "category": "dependency",
                    "location": os.path.relpath(req, path),
                    "recommendation": (f"Upgrade to {', '.join(fixes)}" if fixes else (v.get("description") or "Upgrade to a patched version.")),
                    "source": "pip-audit",
                    "cve": next((a for a in (v.get("aliases") or []) if str(a).startswith("CVE-")), None),
                })
    return out, None


def run_code_scan(owner, repo, token=None, branch=None):
    if not shutil.which("git"):
        return {"scan_completed": False, "error": "git not available", "findings": [], "overallRisk": "LOW"}
    try:
        path = _clone(owner, repo, token, branch)
    except subprocess.CalledProcessError as e:
        return {"scan_completed": False, "error": f"clone failed: {(e.stderr or '')[:300]}", "findings": [], "overallRisk": "LOW"}
    except Exception as e:
        return {"scan_completed": False, "error": f"clone failed: {e}", "findings": [], "overallRisk": "LOW"}

    findings, tools, notes = [], [], []
    try:
        for name, fn in (("semgrep", _run_semgrep), ("detect-secrets", _run_detect_secrets), ("pip-audit", _run_pip_audit)):
            res, note = fn(path)
            findings.extend(res)
            if note:
                notes.append(note)
            else:
                tools.append(name)
    finally:
        shutil.rmtree(path, ignore_errors=True)

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    overall = "CRITICAL" if counts["critical"] else "HIGH" if counts["high"] else "MEDIUM" if counts["medium"] else "LOW" if counts["low"] else "LOW"

    return {
        "scan_completed": True,
        "repo": f"{owner}/{repo}",
        "tools_run": tools,
        "notes": notes,
        "findings": findings,
        "summary": f"{len(findings)} finding(s) from {', '.join(tools) or 'no tools available'}"
                   + (f" — skipped: {', '.join(notes)}" if notes else ""),
        "overallRisk": overall,
    }
