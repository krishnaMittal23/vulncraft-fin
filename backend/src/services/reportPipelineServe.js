/**
 * Report generation pipeline. Runs after all workflow nodes finish:
 *   1. normalize  — every tool's raw output → one unified finding schema
 *   2. dedupe     — merge the same finding reported by multiple tools
 *   3. score      — severity counts + overall risk + 0-100 risk score
 *   4. synthesize — ONE LLM call → executive summary + remediation roadmap
 * Deterministic stages always run; synthesis degrades gracefully (free keys /
 * no key / errors) so a report is always produced.
 */
const { getOpenRouterClient } = require("../lib/llm");

const SEV_WEIGHT = { critical: 10, high: 7, medium: 4, low: 1, info: 0 };
const SEV_ORDER = ["info", "low", "medium", "high", "critical"];

const norm = (s) => {
  const v = String(s || "").toLowerCase();
  if (v.includes("crit")) return "critical";
  if (v.includes("high")) return "high";
  if (v.includes("med")) return "medium";
  if (v.includes("low")) return "low";
  return "info";
};

/** Convert every node's raw output into a flat, unified findings list. */
function normalizeFindings(nodeResults = []) {
  const out = [];
  const add = (f) => out.push({
    severity: norm(f.severity),
    title: f.title || "Finding",
    category: f.category || "other",
    location: f.location || "",
    evidence: f.evidence || "",
    recommendation: f.recommendation || "",
    source: f.source,
    cwe: f.cwe,
    cve: f.cve,
  });

  for (const n of nodeResults) {
    const o = n.output || {};
    const t = n.nodeType;

    // web-hygiene + nuclei return a findings[] array directly
    if (Array.isArray(o.findings)) {
      for (const f of o.findings) {
        const isCve = f.cve || (f.template_id && /cve-/i.test(f.template_id));
        add({
          severity: f.severity,
          title: f.title || f.name || f.template_id || "Finding",
          category: t === "nuclei" ? "cve/exposure" : "web-hygiene",
          location: f.matched_at || f.location || f.evidence || "",
          evidence: f.evidence,
          recommendation: f.recommendation || f.description,
          source: t,
          cve: f.cve || (isCve ? f.template_id : undefined),
        });
      }
    }
    if (t === "nmap") {
      for (const p of o.nmap_scan?.open_ports || [])
        add({ severity: "info", title: `Open port ${p.port}/${p.protocol} (${p.service || "?"})`, category: "network", location: `${p.port}`, source: t, recommendation: "Restrict exposure of this service to trusted networks." });
    }
    if (t === "sqlmap" && (o.sqlmap_scan?.vulnerable || o.sqlmap_scan?.is_vulnerable)) {
      add({ severity: "critical", title: `SQL Injection${o.sqlmap_scan.dbms ? ` (${o.sqlmap_scan.dbms})` : ""}`, category: "injection", source: t, recommendation: "Use parameterized queries / prepared statements and validate input." });
    }
    if (t === "gobuster") {
      for (const d of o.directories_found || []) add({ severity: "medium", title: "Exposed directory", category: "exposure", location: d.path || d, source: t, recommendation: "Restrict access or remove the path." });
      for (const f of o.files_found || []) add({ severity: "medium", title: "Exposed file", category: "exposure", location: f.path || f, source: t, recommendation: "Restrict access or remove the file." });
    }
    if (t === "nikto") {
      for (const v of o.nikto_scan?.vulnerabilities || []) {
        const txt = typeof v === "string" ? v : v.msg || v.description || "Issue";
        add({ severity: "high", title: txt.slice(0, 120), category: "web-server", location: (typeof v === "object" && (v.uri || v.url)) || "", source: t, recommendation: "Review server config and patch the reported issue." });
      }
    }
    if (Array.isArray(o.zap_scan?.vulnerabilities)) {
      for (const v of o.zap_scan.vulnerabilities)
        add({ severity: v.risk, title: v.name || "ZAP alert", category: v.owasp_category || "web-app", location: v.url || "", evidence: v.evidence, recommendation: v.solution, source: "owasp-zap", cwe: v.cwe });
    }
    // Fallback: pull from the per-node LLM analysis if a tool had no structured findings
    if (n.detailedAnalysis) {
      for (const c of n.detailedAnalysis.criticalFindings || [])
        add({ severity: "high", title: typeof c === "string" ? c : JSON.stringify(c), category: "analysis", source: t });
    }
  }
  return out;
}

/** Merge findings reported by multiple tools (same title+location), keep worst severity. */
function dedupe(findings) {
  const map = new Map();
  for (const f of findings) {
    const k = `${f.title}|${f.location}`.toLowerCase();
    const ex = map.get(k);
    if (!ex) {
      map.set(k, { ...f, sources: new Set([f.source]) });
    } else {
      ex.sources.add(f.source);
      if (SEV_ORDER.indexOf(f.severity) > SEV_ORDER.indexOf(ex.severity)) ex.severity = f.severity;
    }
  }
  return [...map.values()]
    .map((f) => ({ ...f, sources: [...f.sources].filter(Boolean) }))
    .sort((a, b) => SEV_ORDER.indexOf(b.severity) - SEV_ORDER.indexOf(a.severity));
}

function score(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let raw = 0;
  for (const f of findings) { counts[f.severity]++; raw += SEV_WEIGHT[f.severity]; }
  const overallRisk = counts.critical ? "CRITICAL" : counts.high ? "HIGH" : counts.medium ? "MEDIUM" : counts.low ? "LOW" : "CLEAN";
  return { counts, overallRisk, riskScore: Math.min(100, raw * 3), total: findings.length };
}

async function synthesize(findings, meta, userId) {
  if (!findings.length || process.env.DISABLE_LLM_ANALYSIS === "true") return null;
  try {
    const client = await getOpenRouterClient(userId, { maxRetries: 1 });
    const top = findings.slice(0, 40)
      .map((f) => `- [${f.severity.toUpperCase()}] ${f.title}${f.location ? ` @ ${f.location}` : ""}`)
      .join("\n");
    const prompt = `You are a senior security consultant. Given these consolidated findings for ${meta.targetUrl}, produce an executive report as JSON ONLY:
{
  "executiveSummary": "2-4 sentence overview for stakeholders",
  "topRisks": ["the few most important risks, plain language"],
  "remediation": [{"priority": "P0|P1|P2", "action": "specific, actionable step"}]
}
Findings:
${top}

Return ONLY valid JSON.`;
    const resp = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4-5",
      messages: [
        { role: "system", content: "You are a senior security report writer. Output strict JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });
    const content = resp.choices?.[0]?.message?.content || "";
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (e) {
    console.error("[report-pipeline] synthesis failed:", e.message);
    return null;
  }
}

/** Full pipeline → the structured `summary` object stored on the report. */
async function buildReportSummary(report, userId) {
  const findings = dedupe(normalizeFindings(report.nodeResults || []));
  const s = score(findings);
  const synthesis = await synthesize(findings, { targetUrl: report.targetUrl }, userId);
  return {
    generatedAt: new Date(),
    overallRisk: s.overallRisk,
    riskScore: s.riskScore,
    counts: s.counts,
    totalFindings: s.total,
    findings,
    executiveSummary: synthesis?.executiveSummary || null,
    topRisks: Array.isArray(synthesis?.topRisks) ? synthesis.topRisks : [],
    remediation: Array.isArray(synthesis?.remediation) ? synthesis.remediation : [],
  };
}

module.exports = { buildReportSummary, normalizeFindings, dedupe, score };
