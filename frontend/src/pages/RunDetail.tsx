import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, Circle, MinusCircle, AlertTriangle,
  Globe, Shield, Terminal, FileText, Search, Network, Database, FileCode,
  ShieldCheck, Radar, ShieldQuestion, Mail, Github, MessageCircle, Workflow as WorkflowIcon,
  FileJson, FileText as FileTextIcon, Braces,
} from "lucide-react";
import { authFetch } from "@/lib/api";
import { useWorkflowSocket } from "@/hooks/useWorkflowSocket";
import { BACKEND_URL } from "@/lib/constant";

const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;
const GEIST = { fontFamily: "'Geist', sans-serif" } as const;

type Severity = "critical" | "high" | "medium" | "low" | "info";

const SEV: Record<Severity, { chip: string; bar: string; dot: string }> = {
  critical: { chip: "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30", bar: "#ef4444", dot: "bg-[#ef4444]" },
  high: { chip: "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30", bar: "#ef4444", dot: "bg-[#ef4444]" },
  medium: { chip: "bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30", bar: "#f59e0b", dot: "bg-[#f59e0b]" },
  low: { chip: "bg-[#22C55E]/10 text-[#4be277] border border-[#22C55E]/30", bar: "#22C55E", dot: "bg-[#22C55E]" },
  info: { chip: "bg-zinc-500/10 text-[#bccbb9] border border-zinc-500/30", bar: "#3f3f46", dot: "bg-[#52525b]" },
};

const NODE_ICON: Record<string, ReactNode> = {
  trigger: <Globe className="h-4 w-4" />, gobuster: <Search className="h-4 w-4" />,
  nmap: <Network className="h-4 w-4" />, sqlmap: <Database className="h-4 w-4" />,
  wpscan: <FileCode className="h-4 w-4" />, nikto: <Shield className="h-4 w-4" />,
  "web-hygiene": <ShieldCheck className="h-4 w-4" />, nuclei: <Radar className="h-4 w-4" />,
  "js-recon": <Braces className="h-4 w-4" />,
  "owasp-zap": <ShieldQuestion className="h-4 w-4" />, "owasp-baseline": <ShieldQuestion className="h-4 w-4" />,
  "owasp-vulnerabilities": <ShieldQuestion className="h-4 w-4" />, "owasp-dependency-check": <ShieldQuestion className="h-4 w-4" />,
  "code-scan": <FileCode className="h-4 w-4" />,
  "flow-chart": <WorkflowIcon className="h-4 w-4" />, email: <Mail className="h-4 w-4" />,
  "github-issue": <Github className="h-4 w-4" />, slack: <MessageCircle className="h-4 w-4" />,
};

const normSev = (s: any): Severity => {
  const v = String(s || "").toLowerCase();
  if (v.includes("crit")) return "critical";
  if (v.includes("high")) return "high";
  if (v.includes("med")) return "medium";
  if (v.includes("low")) return "low";
  return "info";
};

const fmtDur = (ms?: number) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};
const fmtTime = (t: any) => new Date(t).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const asText = (v: any) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

function statusIcon(status: string) {
  switch (status) {
    case "running": return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />;
    case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-[#4be277]" />;
    case "failed": return <XCircle className="h-3.5 w-3.5 text-[#ef4444]" />;
    case "pending": return <Circle className="h-3 w-3 text-[#52525b]" />;
    case "skipped": return <MinusCircle className="h-3.5 w-3.5 text-[#52525b]" />;
    default: return <Clock className="h-3.5 w-3.5 text-[#bccbb9]" />;
  }
}

interface Finding { severity: Severity; name: string; location: string; recommendation: string; }

function nodeFindings(node: any): Finding[] {
  const o = node?.output || {};
  const out: Finding[] = [];
  // web-hygiene / nuclei return a findings[] array directly
  if (Array.isArray(o.findings)) {
    for (const f of o.findings) {
      out.push({
        severity: normSev(f.severity),
        name: f.title || f.name || f.template_id || "Finding",
        location: f.matched_at || f.evidence || f.cve || "",
        recommendation: f.recommendation || f.description || "",
      });
    }
  }
  if (node?.nodeType === "nmap" && o.nmap_scan?.open_ports?.length) {
    for (const p of o.nmap_scan.open_ports)
      out.push({ severity: "info", name: `Open port ${p.port}/${p.protocol} (${p.service || "?"})`, location: `${p.port}`, recommendation: "Restrict exposure to trusted networks." });
  }
  if (node?.nodeType === "sqlmap" && (o.sqlmap_scan?.is_vulnerable || o.sqlmap_scan?.vulnerable))
    out.push({ severity: "critical", name: "SQL Injection", location: "", recommendation: "Use parameterized queries and validate input." });
  if (node?.nodeType === "gobuster") {
    for (const d of o.directories_found || []) out.push({ severity: "medium", name: "Exposed directory", location: d.path || d, recommendation: "Restrict or remove the path." });
    for (const f of o.files_found || []) out.push({ severity: "medium", name: "Exposed file", location: f.path || f, recommendation: "Restrict or remove the file." });
  }
  if (node?.nodeType === "nikto" && o.nikto_scan?.vulnerabilities?.length) {
    for (const v of o.nikto_scan.vulnerabilities) {
      const t = typeof v === "string" ? v : v.msg || v.description || "Issue";
      out.push({ severity: "high", name: t.length > 90 ? t.slice(0, 90) + "…" : t, location: (typeof v === "object" && (v.uri || v.url)) || "", recommendation: "Review server config and patch." });
    }
  }
  // ZAP alerts
  if (Array.isArray(o.zap_scan?.vulnerabilities)) {
    for (const v of o.zap_scan.vulnerabilities)
      out.push({ severity: normSev(v.risk), name: v.name || "ZAP alert", location: v.url || "", recommendation: v.solution || "" });
  }
  // Fallback: LLM detailedAnalysis
  if (out.length === 0 && node?.detailedAnalysis) {
    const da = node.detailedAnalysis;
    for (const c of da.criticalFindings || []) out.push({ severity: "high", name: asText(c), location: "", recommendation: "" });
    for (const v of da.vulnerabilities || []) out.push({ severity: normSev(v.severity || v.risk), name: v.name || v.title || asText(v), location: v.matchedAt || v.location || "", recommendation: v.recommendation || v.solution || "" });
  }
  return out;
}

const RunDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [workflowNodes, setWorkflowNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { progress, joinWorkflow } = useWorkflowSocket();
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchReport = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/reports/${id}`);
      if (!res.ok) throw new Error("Failed to load run");
      const data = await res.json();
      const rep = data.report || data;
      setReport(rep);
      const wfId = rep.workflowId?._id || rep.workflowId;
      if (wfId) {
        try {
          const wfRes = await authFetch(`${BACKEND_URL}/api/workflows/${wfId}`);
          if (wfRes.ok) {
            const wf = await wfRes.json();
            setWorkflowNodes((wf.workflow || wf)?.nodes || []);
          }
        } catch { /* non-fatal */ }
        if (rep.status === "running") joinWorkflow(wfId);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load run");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); /* eslint-disable-next-line */ }, [id]);

  // Auto-refresh while a run is active — no manual reload needed. The backend
  // persists node results incrementally, so this fills in the timeline live.
  // (Socket events update it instantly when they arrive; this is the fallback.)
  useEffect(() => {
    if (report?.status !== "running") return;
    const t = setInterval(() => { fetchReport(); }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [report?.status]);

  // When the socket reports completion, refetch promptly for the final report.
  useEffect(() => {
    if (progress?.status === "completed" || progress?.status === "failed") {
      const t = setTimeout(fetchReport, 1000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line
  }, [progress?.status]);

  const liveStatus = progress && progress.status !== "idle" ? progress.status : report?.status;

  // Build the ordered timeline: prefer the workflow's planned nodes (so pending
  // nodes show), overlay executed results + live status.
  const timeline = useMemo(() => {
    const results: any[] = report?.nodeResults || [];
    const byId = new Map(results.map((r) => [r.nodeId, r]));
    const completedLive = new Map((progress?.completedNodes || []).map((n: any) => [n.nodeId, n]));
    const planned = (workflowNodes.length ? workflowNodes : results.map((r) => ({ id: r.nodeId, type: r.nodeType })))
      .filter((n: any) => n.type !== "trigger");

    const runStatus = progress && progress.status !== "idle" ? progress.status : report?.status;
    const isRunning = runStatus === "running";
    const errByNode = new Map((report?.executionErrors || []).map((e: any) => [e.nodeId, e.message]));

    return planned.map((n: any) => {
      const r = byId.get(n.id);
      let status: string;
      if (r) status = r.status;
      else if (progress?.currentNode?.nodeId === n.id) status = "running";
      else if (completedLive.has(n.id)) status = (completedLive.get(n.id) as any).status;
      // The run has ENDED and this node has no result → it never ran.
      else status = isRunning ? "pending" : "skipped";
      const findings = r ? nodeFindings(r) : [];
      return {
        nodeId: n.id,
        nodeType: n.type,
        status,
        duration: r?.duration ?? completedLive.get(n.id)?.duration,
        result: r,
        error: errByNode.get(n.id) || r?.error,
        findings,
        findingCount: findings.length,
      };
    });
  }, [report, workflowNodes, progress]);

  // default selection: the consolidated summary if present, else the active node
  useEffect(() => {
    if (selected) return;
    if (report?.summary) { setSelected("__summary__"); return; }
    if (timeline.length) {
      const active = timeline.find((t) => t.status === "running") || timeline.find((t) => t.status === "failed") || timeline[0];
      setSelected(active.nodeId);
    }
  }, [timeline, selected, report]);

  const selectedNode = timeline.find((t) => t.nodeId === selected);

  // Prefer live socket logs while running; otherwise the logs persisted on the report.
  const allLogs: any[] = useMemo(
    () => (progress?.logs && progress.logs.length ? progress.logs : report?.results?.logs || []),
    [progress?.logs, report]
  );
  const nodeLogs = useMemo(
    () => allLogs.filter((l: any) => selectedNode && l.nodeType === selectedNode.nodeType),
    [allLogs, selectedNode]
  );
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [nodeLogs.length]);

  // run-level severity tally
  const tally = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const t of timeline) for (const f of t.findings) c[f.severity]++;
    return c;
  }, [timeline]);
  const totalFindings = Object.values(tally).reduce((a, b) => a + b, 0);
  const overallRisk = tally.critical ? "CRITICAL" : tally.high ? "HIGH" : tally.medium ? "MEDIUM" : tally.low ? "LOW" : "CLEAN";
  const riskSev = normSev(overallRisk === "CLEAN" ? "low" : overallRisk);
  const doneCount = timeline.filter((t) => t.status === "completed" || t.status === "failed").length;

  const downloadBlob = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const downloadLogs = () => {
    const head =
      `VulnCraft run — ${report.workflowName}\nTarget: ${report.targetUrl}\n` +
      `Status: ${report.status}\nStarted: ${report.startTime}\nDuration: ${fmtDur(report.duration)}\n` +
      `${"=".repeat(60)}\n`;
    const body = allLogs.length
      ? allLogs
          .map((l) => `[${fmtTime(l.timestamp)}] ${(l.level || "info").toUpperCase()}${l.nodeType ? ` (${l.nodeType})` : ""}: ${l.message}`)
          .join("\n")
      : "(no logs were captured for this run)";
    downloadBlob(`run-${report._id}-logs.txt`, head + body, "text/plain");
  };
  const downloadReport = () => downloadBlob(`run-${report._id}.json`, JSON.stringify(report, null, 2), "application/json");

  if (loading)
    return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-[#bccbb9]"><Loader2 className="h-5 w-5 animate-spin mr-2 text-[#4be277]" /> Loading run…</div>;
  if (error || !report)
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4 text-[#bccbb9]" style={GEIST}>
        <p className="text-[#ef4444]">{error || "Run not found"}</p>
        <button onClick={() => navigate("/dashboard/report")} className="px-4 py-2 rounded-lg border border-[#27272a] bg-[#131315] hover:text-[#4be277]">Back to reports</button>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e5e1e4] flex flex-col" style={GEIST}>
      {/* Summary header */}
      <header className="border-b border-[#27272a] px-6 py-4">
        <button onClick={() => navigate("/dashboard/report")} className="flex items-center gap-1.5 text-sm text-[#bccbb9] hover:text-[#4be277] mb-3 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Reports
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{report.workflowName || "Workflow Run"}</h1>
            <span className="flex items-center gap-1.5">{statusIcon(liveStatus)}<span className="text-xs uppercase tracking-wider text-[#bccbb9]" style={MONO}>{liveStatus}</span></span>
            {liveStatus === "running" && <span className="flex items-center gap-1 text-[10px] text-[#4be277]" style={MONO}><span className="h-1.5 w-1.5 rounded-full bg-[#4be277] animate-pulse" /> live</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={downloadLogs} title="Download logs (.txt)"
              className="flex items-center gap-1.5 rounded-lg border border-[#27272a] bg-[#131315] px-3 py-1.5 text-xs text-[#bccbb9] hover:text-[#4be277] hover:border-[#4be277]/40 transition-colors">
              <FileTextIcon className="h-3.5 w-3.5" /> Logs
            </button>
            <button onClick={downloadReport} title="Download full report (.json)"
              className="flex items-center gap-1.5 rounded-lg border border-[#27272a] bg-[#131315] px-3 py-1.5 text-xs text-[#bccbb9] hover:text-[#4be277] hover:border-[#4be277]/40 transition-colors">
              <FileJson className="h-3.5 w-3.5" /> JSON
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={MONO}>
          <a href={report.targetUrl} target="_blank" rel="noreferrer" className="text-[#bccbb9] hover:text-[#4be277] truncate max-w-[320px]">🌐 {report.targetUrl}</a>
          <span className="text-[#3f3f46]">·</span>
          <span className="text-[#bccbb9]/70">{doneCount}/{timeline.length} nodes</span>
          <span className="text-[#3f3f46]">·</span>
          <span className="text-[#bccbb9]/70">started {fmtTime(report.startTime)}</span>
          {report.duration != null && (<><span className="text-[#3f3f46]">·</span><span className="text-[#bccbb9]/70">{fmtDur(report.duration)}</span></>)}
        </div>
        {/* severity bar + counts */}
        <div className="mt-4 flex items-center gap-4">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${SEV[riskSev].chip}`} style={MONO}>RISK: {overallRisk}</span>
          <div className="flex h-2 flex-1 max-w-md overflow-hidden rounded-full bg-[#18181b]">
            {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) =>
              tally[s] ? <div key={s} style={{ width: `${(tally[s] / totalFindings) * 100}%`, background: SEV[s].bar }} /> : null
            )}
          </div>
          <span className="text-xs text-[#bccbb9]/70" style={MONO}>{totalFindings} findings</span>
        </div>

        {/* Failure banner — make a failed run unmistakable + show why */}
        {liveStatus === "failed" && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
            <AlertTriangle className="h-4 w-4 text-[#ef4444] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#ef4444]">This run failed</p>
              {(report.executionErrors || []).length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-[#ef4444]/80" style={MONO}>
                  {report.executionErrors.slice(0, 5).map((e: any, i: number) => (
                    <li key={i}>{e.nodeType ? `[${e.nodeType}] ` : ""}{e.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-[#ef4444]/80">See the logs below for details.</p>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Master / detail */}
      <div className="flex flex-1 min-h-0">
        {/* Timeline rail */}
        <aside className="w-64 shrink-0 border-r border-[#27272a] overflow-y-auto p-3">
          {report.summary && (
            <button
              onClick={() => setSelected("__summary__")}
              className={`w-full mb-2 text-left rounded-lg px-3 py-2.5 transition-colors border ${selected === "__summary__" ? "bg-[#4be277]/10 border-[#4be277]/30" : "border-[#27272a] hover:bg-[#131315]"}`}
            >
              <div className="flex items-center gap-2">
                <FileTextIcon className={`h-4 w-4 shrink-0 ${selected === "__summary__" ? "text-[#4be277]" : "text-[#bccbb9]"}`} />
                <span className="flex-1 text-sm font-bold">Report Summary</span>
              </div>
              <p className="mt-1 pl-6 text-[10px] text-[#bccbb9]/60" style={MONO}>
                {report.summary.overallRisk} · {report.summary.totalFindings} findings
              </p>
            </button>
          )}
          <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.18em] text-[#bccbb9]/50" style={MONO}>Timeline</p>
          <div className="space-y-1">
            {timeline.map((t, i) => {
              const active = t.nodeId === selected;
              const worst = t.findings.reduce<Severity>((acc, f) => {
                const order = ["info", "low", "medium", "high", "critical"];
                return order.indexOf(f.severity) > order.indexOf(acc) ? f.severity : acc;
              }, "info");
              return (
                <button key={t.nodeId} onClick={() => setSelected(t.nodeId)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border ${active ? "bg-[#4be277]/10 border-[#4be277]/30" : "border-transparent hover:bg-[#131315]"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 ${active ? "text-[#4be277]" : "text-[#bccbb9]"}`}>{NODE_ICON[t.nodeType] || <Terminal className="h-4 w-4" />}</span>
                    <span className="flex-1 text-sm font-medium truncate">{t.nodeType}</span>
                    {statusIcon(t.status)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-6 text-[10px]" style={MONO}>
                    <span className="text-[#bccbb9]/50">{i + 1}</span>
                    {t.duration != null && <span className="text-[#bccbb9]/50">{fmtDur(t.duration)}</span>}
                    {t.findingCount > 0 && (
                      <span className="flex items-center gap-1 text-[#bccbb9]/70">
                        <span className={`h-1.5 w-1.5 rounded-full ${SEV[worst].dot}`} />{t.findingCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Detail pane */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6">
          {selected === "__summary__" && report.summary ? (
            <div className="space-y-6 max-w-3xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Consolidated Report</h2>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${SEV[normSev(report.summary.overallRisk === "CLEAN" ? "low" : report.summary.overallRisk)].chip}`} style={MONO}>
                  {report.summary.overallRisk} · score {report.summary.riskScore}/100
                </span>
              </div>

              {report.summary.executiveSummary && (
                <section>
                  <h3 className="text-xs uppercase tracking-[0.18em] text-[#bccbb9]/50 mb-2" style={MONO}>Executive Summary</h3>
                  <p className="text-sm text-[#d4d4d8] leading-relaxed rounded-lg border border-[#27272a] bg-[#131315] p-3">{report.summary.executiveSummary}</p>
                </section>
              )}

              {report.summary.topRisks?.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-[0.18em] text-[#bccbb9]/50 mb-2" style={MONO}>Top Risks</h3>
                  <ul className="space-y-1.5">
                    {report.summary.topRisks.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#d4d4d8]"><span className="text-[#ef4444] mt-0.5">▸</span>{r}</li>
                    ))}
                  </ul>
                </section>
              )}

              {report.summary.remediation?.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-[0.18em] text-[#bccbb9]/50 mb-2" style={MONO}>Remediation Roadmap</h3>
                  <div className="space-y-2">
                    {report.summary.remediation.map((r: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-[#27272a] bg-[#131315] p-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#4be277]/10 text-[#4be277] shrink-0" style={MONO}>{r.priority}</span>
                        <span className="text-sm text-[#d4d4d8]">{r.action}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs uppercase tracking-[0.18em] text-[#bccbb9]/50 mb-2" style={MONO}>
                  All Findings ({report.summary.findings?.length || 0})
                </h3>
                {(report.summary.findings || []).length === 0 ? (
                  <p className="text-sm text-[#bccbb9]/50 rounded-lg border border-dashed border-[#27272a] p-4 text-center">No findings.</p>
                ) : (
                  <div className="space-y-1.5">
                    {report.summary.findings.map((f: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-[#27272a] bg-[#131315] p-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${SEV[normSev(f.severity)].chip}`} style={MONO}>{String(f.severity).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium break-words">{f.title}</p>
                          {f.location && <p className="text-[11px] text-[#bccbb9]/60 break-all" style={MONO}>{f.location}</p>}
                          {f.recommendation && <p className="text-xs text-[#bccbb9]/80 mt-0.5">{f.recommendation}</p>}
                          {f.sources?.length > 0 && <p className="text-[10px] text-[#bccbb9]/40 mt-0.5" style={MONO}>via {f.sources.join(", ")}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : !selectedNode ? (
            <div className="text-[#bccbb9]/50 text-sm">Select a node to view its findings and logs.</div>
          ) : (
            <div className="space-y-6 max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#131315] border border-[#27272a] text-[#4be277]">{NODE_ICON[selectedNode.nodeType] || <Terminal className="h-4 w-4" />}</span>
                <div>
                  <h2 className="text-lg font-bold">{selectedNode.nodeType}</h2>
                  <p className="text-xs text-[#bccbb9]/60" style={MONO}>{selectedNode.status} · {fmtDur(selectedNode.duration)} · {selectedNode.findingCount} findings</p>
                </div>
              </div>

              {/* Findings */}
              <section>
                <h3 className="text-xs uppercase tracking-[0.18em] text-[#bccbb9]/50 mb-2" style={MONO}>Findings</h3>
                {selectedNode.findings.length === 0 ? (
                  <p className="text-sm text-[#bccbb9]/50 rounded-lg border border-dashed border-[#27272a] p-4 text-center">
                    {selectedNode.status === "pending"
                      ? "Not run yet."
                      : selectedNode.status === "running"
                        ? "Scanning…"
                        : selectedNode.status === "skipped"
                          ? "Did not run — the run ended before reaching this node."
                          : selectedNode.status === "failed"
                            ? `Failed: ${selectedNode.error || "see logs below"}`
                            : "No findings from this node."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedNode.findings.map((f, i) => (
                      <div key={i} className="rounded-lg border border-[#27272a] bg-[#131315] p-3">
                        <div className="flex items-start gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${SEV[f.severity].chip}`} style={MONO}>{f.severity.toUpperCase()}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium break-words">{f.name}</p>
                            {f.location && <p className="text-[11px] text-[#bccbb9]/60 break-all" style={MONO}>{f.location}</p>}
                            {f.recommendation && <p className="text-xs text-[#bccbb9]/80 mt-1">{f.recommendation}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* AI summary */}
              {selectedNode.result?.detailedAnalysis?.summary && (
                <section>
                  <h3 className="text-xs uppercase tracking-[0.18em] text-[#bccbb9]/50 mb-2" style={MONO}>AI Analysis</h3>
                  <p className="text-sm text-[#d4d4d8] rounded-lg border border-[#27272a] bg-[#131315] p-3 leading-relaxed">{asText(selectedNode.result.detailedAnalysis.summary)}</p>
                </section>
              )}

              {/* Logs */}
              <section>
                <h3 className="text-xs uppercase tracking-[0.18em] text-[#bccbb9]/50 mb-2 flex items-center gap-1.5" style={MONO}><Terminal className="h-3 w-3" /> Logs</h3>
                <div className="rounded-lg border border-[#27272a] bg-[#0c0c0e] p-3 max-h-72 overflow-y-auto text-xs space-y-0.5" style={MONO}>
                  {nodeLogs.length === 0 ? (
                    <p className="text-[#bccbb9]/40 text-[11px]">{liveStatus === "running" ? "Waiting for logs…" : "No logs recorded for this node."}</p>
                  ) : (
                    <>
                      {nodeLogs.map((l: any, i: number) => {
                        const color = l.level === "error" ? "text-red-400" : l.level === "warning" ? "text-amber-400" : "text-[#bccbb9]";
                        return (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[#52525b] shrink-0">{fmtTime(l.timestamp)}</span>
                            <span className={`uppercase text-[9px] mt-[2px] shrink-0 ${color}`}>{(l.level || "info").slice(0, 4)}</span>
                            <span className="flex-1 break-words text-[#d4d4d8]">{l.message}</span>
                          </div>
                        );
                      })}
                      <div ref={logEndRef} />
                    </>
                  )}
                </div>
              </section>

              {/* Raw output */}
              {selectedNode.result?.output && (
                <details className="rounded-lg border border-[#27272a] bg-[#131315]">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-[#bccbb9] hover:text-[#4be277] flex items-center gap-1.5"><FileText className="h-3 w-3" /> Raw output</summary>
                  <pre className="px-3 pb-3 text-[11px] text-[#bccbb9]/70 overflow-x-auto" style={MONO}>{JSON.stringify(selectedNode.result.output, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default RunDetail;
