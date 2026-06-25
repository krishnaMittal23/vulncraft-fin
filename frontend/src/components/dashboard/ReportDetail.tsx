import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  ShieldAlert,
  FileSearch,
  Layers,
} from "lucide-react";
import { authFetch } from "@/lib/api";
import { BACKEND_URL } from "@/lib/constant";

/* ----- types (mirrors the Report shape returned by GET /api/reports/:id) ----- */
interface NodeResult {
  nodeId: string;
  nodeType: string;
  status: string;
  output: any;
  detailedAnalysis?: {
    summary?: string;
    overallRisk?: string;
    criticalFindings?: any[];
    recommendations?: any[];
    [k: string]: any;
  };
  duration: number;
}

interface ExecutionError {
  nodeId?: string;
  nodeType?: string;
  message: string;
  timestamp: string;
}

interface Report {
  _id: string;
  workflowId: any; // may be populated to { name }
  workflowName: string;
  targetUrl: string;
  status: "running" | "completed" | "failed" | "partial";
  startTime: string;
  endTime?: string;
  duration?: number;
  findings: { total: number };
  nodeResults: NodeResult[];
  executionErrors: ExecutionError[];
  createdAt: string;
  updatedAt: string;
}

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface DerivedFinding {
  severity: Severity;
  name: string;
  location: string;
  recommendation: string;
}

const MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const GEIST = "'Geist', sans-serif";

/* ----- severity presentation (matches ReportViewer tokens) ----- */
const SEVERITY_STYLES: Record<
  Severity,
  { chip: string; bar: string; label: string }
> = {
  critical: {
    chip: "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30",
    bar: "#ef4444",
    label: "CRITICAL",
  },
  high: {
    chip: "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30",
    bar: "#ef4444",
    label: "HIGH",
  },
  medium: {
    chip: "bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30",
    bar: "#f59e0b",
    label: "MEDIUM",
  },
  low: {
    chip: "bg-[#22C55E]/10 text-[#4be277] border border-[#22C55E]/30",
    bar: "#22C55E",
    label: "LOW",
  },
  info: {
    chip: "bg-zinc-500/10 text-[#bccbb9] border border-zinc-500/30",
    bar: "#3f3f46",
    label: "INFO",
  },
};

const STATUS_STYLES: Record<string, { label: string; chip: string }> = {
  completed: {
    label: "COMPLETED",
    chip: "bg-[#22C55E]/10 text-[#4be277] border border-[#22C55E]/30",
  },
  running: {
    label: "RUNNING",
    chip: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  },
  failed: {
    label: "FAILED",
    chip: "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30",
  },
  partial: {
    label: "PARTIAL",
    chip: "bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30",
  },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || {
    label: "UNKNOWN",
    chip: "bg-zinc-500/10 text-[#bccbb9] border border-zinc-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${s.chip}`}
      style={{ fontFamily: MONO }}
    >
      {s.label}
    </span>
  );
}

function statusIcon(status: string) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-[#4be277]" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-[#ef4444]" />;
    case "partial":
      return <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />;
    default:
      return <Clock className="h-4 w-4 text-[#bccbb9]" />;
  }
}

/* Derive a flat vulnerability list — replicates ReportViewer.deriveFindings(). */
function deriveFindings(report: Report): DerivedFinding[] {
  const out: DerivedFinding[] = [];
  const target = report.targetUrl || "";

  for (const node of report.nodeResults || []) {
    const o = node.output || {};

    // nmap open ports -> info
    if (node.nodeType === "nmap" && o.nmap_scan?.open_ports?.length) {
      for (const port of o.nmap_scan.open_ports) {
        out.push({
          severity: "info",
          name: `Open port: ${port.service || "unknown"} (${port.port}/${port.protocol})`,
          location: `${target}:${port.port}`,
          recommendation:
            "Restrict exposure of this service to trusted networks only.",
        });
      }
    }

    // sqlmap SQL injection -> critical when vulnerable
    if (node.nodeType === "sqlmap" && o.sqlmap_scan) {
      const vulnerable =
        o.sqlmap_scan.is_vulnerable || o.sqlmap_scan.vulnerable;
      if (vulnerable) {
        out.push({
          severity: "critical",
          name: "SQL Injection",
          location: target,
          recommendation:
            "Use parameterized queries / prepared statements and validate all input.",
        });
      }
    }

    // gobuster exposed directories/files -> medium
    if (node.nodeType === "gobuster") {
      for (const dir of o.directories_found || []) {
        out.push({
          severity: "medium",
          name: "Exposed directory",
          location: dir.path || dir,
          recommendation: "Restrict access or remove the exposed path.",
        });
      }
      for (const file of o.files_found || []) {
        out.push({
          severity: "medium",
          name: "Exposed file",
          location: file.path || file,
          recommendation: "Restrict access or remove the exposed file.",
        });
      }
    }

    // nikto web-server vulnerabilities -> high
    if (node.nodeType === "nikto" && o.nikto_scan?.vulnerabilities?.length) {
      for (const vuln of o.nikto_scan.vulnerabilities) {
        const text =
          typeof vuln === "string"
            ? vuln
            : vuln.msg || vuln.message || vuln.description || "Issue detected";
        const uri =
          typeof vuln === "object" ? vuln.uri || vuln.url || target : target;
        out.push({
          severity: "high",
          name: text.length > 80 ? text.slice(0, 80) + "…" : text,
          location: uri,
          recommendation:
            "Review the server configuration and patch the reported issue.",
        });
      }
    }
  }

  // Fall back to LLM recommendations as info findings
  if (out.length === 0) {
    for (const node of report.nodeResults || []) {
      const recs = node.detailedAnalysis?.recommendations;
      if (Array.isArray(recs)) {
        for (const rec of recs) {
          out.push({
            severity: "info",
            name: `${node.nodeType} recommendation`,
            location: target,
            recommendation:
              typeof rec === "string" ? rec : JSON.stringify(rec),
          });
        }
      }
    }
  }

  return out;
}

function severityCounts(findings: DerivedFinding[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function fmtDuration(ms?: number) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

/* Render an LLM analysis value that may be a string or an object. */
function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    return (
      v.title ||
      v.name ||
      v.message ||
      v.description ||
      v.recommendation ||
      JSON.stringify(v)
    );
  }
  return String(v);
}

/* ----- small UI atoms ----- */
function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] tracking-wide text-[#bccbb9] mb-1"
        style={{ fontFamily: MONO }}
      >
        {label}
      </div>
      <div className="text-sm text-[#e5e1e4]">{value}</div>
    </div>
  );
}

function SeverityTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-[#131315] border border-[#27272a] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span
          className="text-[10px] tracking-wide"
          style={{ fontFamily: MONO, color }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-[28px] leading-none font-bold"
        style={{ fontFamily: MONO, color: "#e5e1e4" }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);
        const res = await authFetch(`${BACKEND_URL}/api/reports/${id}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch report");
        const data = await res.json();
        if (!cancelled) {
          if (!data?.report) setNotFound(true);
          else setReport(data.report as Report);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const findings = useMemo(
    () => (report ? deriveFindings(report) : []),
    [report]
  );
  const counts = useMemo(() => severityCounts(findings), [findings]);
  const totalFindings =
    counts.critical + counts.high + counts.medium + counts.low + counts.info;
  const seg = (n: number) =>
    totalFindings > 0 ? `${(n / totalFindings) * 100}%` : "0%";

  const workflowName =
    report?.workflowName ||
    (report?.workflowId && typeof report.workflowId === "object"
      ? report.workflowId.name
      : "") ||
    "Unnamed Workflow";

  const handleExport = () => {
    if (!report) return;
    const blob = new Blob(
      [JSON.stringify({ report, findings }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${report._id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const BackButton = (
    <button
      onClick={() => navigate("/dashboard/report")}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3f3f46] text-[#e5e1e4] text-sm hover:bg-[#27272a] transition-colors cursor-pointer"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div
      className="min-h-screen bg-[#09090b] text-[#e5e1e4] p-6 md:p-10"
      style={{ fontFamily: GEIST }}
    >
      <div className="max-w-6xl mx-auto">{children}</div>
    </div>
  );

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <Shell>
        <div className="mb-6">{BackButton}</div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#4be277]" />
        </div>
      </Shell>
    );
  }

  /* ---------- error ---------- */
  if (error) {
    return (
      <Shell>
        <div className="mb-6">{BackButton}</div>
        <div className="bg-[#131315] border border-[#ef4444]/30 rounded-xl p-6">
          <div className="flex items-center gap-2 text-[#ef4444] mb-3">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold">Error Loading Report</span>
          </div>
          <p className="text-[#bccbb9] text-sm">{error}</p>
        </div>
      </Shell>
    );
  }

  /* ---------- not found ---------- */
  if (notFound || !report) {
    return (
      <Shell>
        <div className="mb-6">{BackButton}</div>
        <div className="bg-[#131315] border border-[#27272a] rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <FileSearch className="h-10 w-10 text-[#bccbb9] mb-4 opacity-70" />
          <p className="text-[#e5e1e4] font-semibold mb-1">Report not found</p>
          <p className="text-[#bccbb9] text-sm">
            This report may have been deleted or the ID is invalid.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* ---------- Header ---------- */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          {BackButton}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">{workflowName}</h1>
            <StatusChip status={report.status} />
          </div>
          <p
            className="text-sm text-[#bccbb9] mt-2 break-all"
            style={{ fontFamily: MONO }}
          >
            {report.targetUrl}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-[#4be277] px-4 py-2 rounded-lg text-[#003915] text-sm font-bold transition-transform hover:scale-[1.02] cursor-pointer shrink-0"
        >
          <Download className="h-4 w-4" />
          EXPORT JSON
        </button>
      </div>

      {/* ---------- Meta row ---------- */}
      <div className="bg-[#131315] border border-[#27272a] rounded-xl p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          <MetaItem label="STARTED" value={fmtDate(report.startTime)} />
          <MetaItem label="ENDED" value={fmtDate(report.endTime)} />
          <MetaItem label="DURATION" value={fmtDuration(report.duration)} />
          <MetaItem label="CREATED" value={fmtDate(report.createdAt)} />
          <MetaItem
            label="REPORT ID"
            value={
              <span style={{ fontFamily: MONO }} className="break-all text-xs">
                {report._id}
              </span>
            }
          />
        </div>
      </div>

      {/* ---------- Severity summary ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <SeverityTile label="CRITICAL" value={counts.critical} color="#ef4444" />
        <SeverityTile label="HIGH" value={counts.high} color="#ef4444" />
        <SeverityTile label="MEDIUM" value={counts.medium} color="#f59e0b" />
        <SeverityTile label="LOW" value={counts.low} color="#22C55E" />
        <SeverityTile label="INFO" value={counts.info} color="#bccbb9" />
      </div>

      {/* stacked severity bar */}
      <div className="bg-[#131315] border border-[#27272a] rounded-xl p-5 mb-6">
        <div
          className="flex justify-between text-[10px] text-[#bccbb9] mb-2"
          style={{ fontFamily: MONO }}
        >
          <span>SEVERITY DISTRIBUTION</span>
          <span>{totalFindings} TOTAL FINDINGS</span>
        </div>
        <div className="h-2 w-full flex rounded-full overflow-hidden bg-[#27272a]">
          <div
            style={{ width: seg(counts.critical + counts.high), backgroundColor: SEVERITY_STYLES.critical.bar }}
          />
          <div
            style={{ width: seg(counts.medium), backgroundColor: SEVERITY_STYLES.medium.bar }}
          />
          <div
            style={{ width: seg(counts.low), backgroundColor: SEVERITY_STYLES.low.bar }}
          />
          <div
            style={{ width: seg(counts.info), backgroundColor: SEVERITY_STYLES.info.bar }}
          />
        </div>
      </div>

      {/* ---------- Vulnerability findings table ---------- */}
      <div className="bg-[#131315] border border-[#27272a] rounded-xl mb-6 overflow-hidden">
        <div className="p-5 border-b border-[#27272a] flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[#4be277]" />
          <h2 className="font-bold text-[#e5e1e4]">Vulnerability Findings</h2>
        </div>
        {findings.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-8 w-8 text-[#4be277] mb-3 opacity-70" />
            <p className="text-[#bccbb9] text-sm">
              No structured findings were derived for this report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#09090b]/50 border-b border-[#27272a]">
                <tr>
                  {["SEVERITY", "NAME", "LOCATION", "RECOMMENDATION"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-[11px] font-bold text-[#bccbb9]"
                      style={{ fontFamily: MONO }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {findings.map((f, i) => {
                  const s = SEVERITY_STYLES[f.severity];
                  return (
                    <tr key={i} className="hover:bg-[#1c1b1d] transition-colors">
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.chip}`}
                          style={{ fontFamily: MONO }}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-[#e5e1e4] text-sm align-top">
                        {f.name}
                      </td>
                      <td
                        className="px-5 py-4 text-xs text-[#bccbb9] align-top break-all"
                        style={{ fontFamily: MONO }}
                      >
                        {f.location}
                      </td>
                      <td className="px-5 py-4 text-sm text-[#bccbb9] italic align-top max-w-md">
                        {f.recommendation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Per-node breakdown ---------- */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-[#4be277]" />
          <h2 className="font-bold text-[#e5e1e4]">
            Node Results ({report.nodeResults?.length || 0})
          </h2>
        </div>

        {(report.nodeResults?.length || 0) === 0 ? (
          <div className="bg-[#131315] border border-[#27272a] rounded-xl p-8 text-center text-sm text-[#bccbb9]">
            No node results recorded.
          </div>
        ) : (
          <div className="space-y-4">
            {report.nodeResults.map((node, i) => {
              const da = node.detailedAnalysis;
              return (
                <div
                  key={node.nodeId || i}
                  className="bg-[#131315] border border-[#27272a] rounded-xl p-5"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {statusIcon(node.status)}
                      <span
                        className="font-bold text-[#e5e1e4] uppercase tracking-wide text-sm"
                        style={{ fontFamily: MONO }}
                      >
                        {node.nodeType || "node"}
                      </span>
                      <StatusChip status={node.status} />
                    </div>
                    <span
                      className="text-[11px] text-[#bccbb9]"
                      style={{ fontFamily: MONO }}
                    >
                      {fmtDuration(node.duration)}
                    </span>
                  </div>

                  {/* LLM detailed analysis */}
                  {da && (
                    <div className="mt-4 space-y-3">
                      {da.summary && (
                        <div>
                          <div
                            className="text-[10px] tracking-wide text-[#bccbb9] mb-1"
                            style={{ fontFamily: MONO }}
                          >
                            SUMMARY
                          </div>
                          <p className="text-sm text-[#e5e1e4]">
                            {asText(da.summary)}
                          </p>
                        </div>
                      )}

                      {da.overallRisk && (
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] tracking-wide text-[#bccbb9]"
                            style={{ fontFamily: MONO }}
                          >
                            OVERALL RISK
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30"
                            style={{ fontFamily: MONO }}
                          >
                            {asText(da.overallRisk).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {Array.isArray(da.criticalFindings) &&
                        da.criticalFindings.length > 0 && (
                          <div>
                            <div
                              className="text-[10px] tracking-wide text-[#ef4444] mb-1"
                              style={{ fontFamily: MONO }}
                            >
                              CRITICAL FINDINGS
                            </div>
                            <ul className="list-disc list-inside space-y-1">
                              {da.criticalFindings.map((c, ci) => (
                                <li key={ci} className="text-sm text-[#e5e1e4]">
                                  {asText(c)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {Array.isArray(da.recommendations) &&
                        da.recommendations.length > 0 && (
                          <div>
                            <div
                              className="text-[10px] tracking-wide text-[#4be277] mb-1"
                              style={{ fontFamily: MONO }}
                            >
                              RECOMMENDATIONS
                            </div>
                            <ul className="list-disc list-inside space-y-1">
                              {da.recommendations.map((r, ri) => (
                                <li
                                  key={ri}
                                  className="text-sm text-[#bccbb9]"
                                >
                                  {asText(r)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Raw output */}
                  <details className="mt-4 group">
                    <summary
                      className="cursor-pointer text-[11px] text-[#bccbb9] hover:text-[#e5e1e4] transition-colors select-none"
                      style={{ fontFamily: MONO }}
                    >
                      RAW OUTPUT
                    </summary>
                    <pre
                      className="mt-2 max-h-96 overflow-auto rounded-lg bg-[#09090b] border border-[#27272a] p-3 text-[11px] text-[#bccbb9] whitespace-pre-wrap break-all"
                      style={{ fontFamily: MONO }}
                    >
                      {JSON.stringify(node.output, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Execution errors ---------- */}
      {report.executionErrors?.length > 0 && (
        <div className="bg-[#131315] border border-[#ef4444]/30 rounded-xl p-5">
          <div className="flex items-center gap-2 text-[#ef4444] mb-3">
            <AlertOctagon className="h-4 w-4" />
            <span className="font-semibold text-sm">
              Execution Errors ({report.executionErrors.length})
            </span>
          </div>
          <div className="space-y-3">
            {report.executionErrors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-[#bccbb9]"
              >
                {statusIcon("failed")}
                <div className="min-w-0">
                  <div className="text-[#e5e1e4] font-medium">
                    {err.nodeType || "General Error"}
                  </div>
                  <div className="break-words">{err.message}</div>
                  <div
                    className="text-[11px] mt-0.5 opacity-70"
                    style={{ fontFamily: MONO }}
                  >
                    {fmtDate(err.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
