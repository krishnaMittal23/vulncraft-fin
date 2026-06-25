"""Nuclei scanner wrapper.

Runs ProjectDiscovery's `nuclei` against a target and parses its JSONL output
into a structured report. Nuclei's template-based checks (CVEs, exposures,
misconfigurations, default creds) are what surface real issues on modern sites.
The `nuclei` binary is installed in the Docker image; if absent, we degrade
gracefully with a clear message.
"""
import json
import logging
import shutil
import subprocess

logger = logging.getLogger(__name__)

# Cap runtime so a workflow node can't hang. Tune via the view if needed.
_DEFAULT_TIMEOUT = 240
_SEVERITY_RANK = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def nuclei_available():
    return shutil.which("nuclei") is not None


def run_nuclei(url, severity="low,medium,high,critical", timeout=_DEFAULT_TIMEOUT):
    """Run nuclei against `url`. Returns a structured findings report."""
    if not nuclei_available():
        return {
            "scan_completed": False,
            "error": "nuclei binary not installed in scanner image",
            "summary": "Nuclei is not available. Rebuild the scanner image to enable it.",
            "findings": [],
            "overallRisk": "LOW",
        }

    if not url.startswith(("http://", "https://")):
        url = "http://" + url

    cmd = [
        "nuclei",
        "-target", url,
        "-jsonl",
        "-silent",
        "-severity", severity,
        "-timeout", "5",
        "-rate-limit", "50",
        "-no-interactsh",
        "-disable-update-check",
    ]

    try:
        proc = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return {
            "scan_completed": False,
            "error": f"nuclei timed out after {timeout}s",
            "summary": "Nuclei scan timed out; partial results unavailable.",
            "findings": [],
            "overallRisk": "LOW",
        }
    except Exception as e:
        logger.exception("nuclei execution failed")
        return {
            "scan_completed": False,
            "error": str(e),
            "summary": f"Nuclei failed to run: {e}",
            "findings": [],
            "overallRisk": "LOW",
        }

    findings = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        info = row.get("info", {})
        findings.append({
            "template_id": row.get("template-id"),
            "name": info.get("name"),
            "severity": (info.get("severity") or "info").upper(),
            "type": row.get("type"),
            "matched_at": row.get("matched-at") or row.get("host"),
            "description": info.get("description"),
            "reference": info.get("reference"),
            "tags": info.get("tags"),
            "cve": (info.get("classification") or {}).get("cve-id"),
        })

    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    if counts["CRITICAL"]:
        overall = "CRITICAL"
    elif counts["HIGH"]:
        overall = "HIGH"
    elif counts["MEDIUM"]:
        overall = "MEDIUM"
    else:
        overall = "LOW"

    return {
        "scan_completed": True,
        "target_url": url,
        "summary": (
            f"{len(findings)} finding(s): {counts['CRITICAL']} critical, "
            f"{counts['HIGH']} high, {counts['MEDIUM']} medium, {counts['LOW']} low."
        ),
        "findings": findings,
        "finding_counts": counts,
        "overallRisk": overall,
    }
