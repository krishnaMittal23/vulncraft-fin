import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Download,
  ShieldCheck,
  History,
  ChevronDown,
} from "lucide-react";
import { authFetch } from "@/lib/api";
import { BACKEND_URL } from "@/lib/constant";




const MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const GEIST = "'Geist', ui-sans-serif, system-ui, sans-serif";

/* ----- severity presentation ----- */
const SEVERITY_STYLES = {
  critical: {
    label: "CRITICAL",
    chip: "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30",
    bar: "#ef4444",
  },
  high: {
    label: "HIGH",
    chip: "bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/30",
    bar: "#f97316",
  },
  medium: {
    label: "MEDIUM",
    chip: "bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30",
    bar: "#f59e0b",
  },
  low: {
    label: "LOW",
    chip: "bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30",
    bar: "#22c55e",
  },
  info: {
    label: "INFO",
    chip: "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30",
    bar: "#3b82f6",
  },
};

/* ----- status chip presentation -----
 * Maps the real status union onto the design's vocabulary. */
const STATUS_STYLES = {
  completed: {
    label: "COMPLETED",
    chip: "bg-[#4be277]/10 text-[#4be277] border border-[#4be277]/30",
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

function statusChip(status) {
  const s = STATUS_STYLES[status] || {
    label: "STABLE",
    chip: "bg-zinc-500/10 text-[#bccbb9] border border-zinc-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${s.chip}`}
      style={{ fontFamily: GEIST }}
    >
      {s.label}
    </span>
  );
}

function statusIcon(status) {
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

/* Derive a flat vulnerability list from the existing nodeResults structure.
 * The backend stores raw tool output per node; there is no flat findings array,
 * so we map each tool's known output shape into {severity,name,location,recommendation}. */
function deriveFindings(report){
  const out= [];
  const target = report.targetUrl || "";

  for (const node of report.nodeResults || []) {
    const o = node.output || {};

    // nmap open ports -> info-level findings
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

  // Fall back to LLM recommendations  findings if nothing structured surfaced
  if (out.length === 0) {
    for (const node of report.nodeResults || []) {
      const recs = node.detailedAnalysis?.recommendations;
      if (Array.isArray(recs)) {
        for (const rec of recs) {
          out.push({
            severity: "info",
            name: `${node.nodeType} recommendation`,
            location: target,
            recommendation: rec,
          });
        }
      }
    }
  }

  return out;
}

function severityCounts(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

/* ----- stat tile ----- */
function StatTile({
  label,
  value,
  color,
  Icon,
  hoverBorder,
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#131315] border border-[#27272a] p-6 rounded-xl transition-colors ${hoverBorder}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span
          className="text-[11px] tracking-wide"
          style={{ fontFamily: GEIST, color }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-[32px] leading-none font-bold"
        style={{ fontFamily: GEIST, color: "#e5e1e4" }}
      >
        {value}
      </div>
      <div className="absolute top-4 right-4 opacity-20" style={{ color }}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
}

export default function ReportViewer({ workflowId }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [stats, setStats] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("all");

  useEffect(() => {
    fetchReports();
  }, [workflowId]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = workflowId
        ? `${BACKEND_URL}/api/reports/workflow/${workflowId}`
        : `${BACKEND_URL}/api/reports`;

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }

      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  // Optional stats fetch for the 4 tiles; resilient — falls back to zeros.
  const fetchStats = async () => {
    try {
      const response = await authFetch(`${BACKEND_URL}/api/reports/stats`);
      if (!response.ok) return;
      const data = await response.json();
      if (data?.stats) setStats(data.stats );
    } catch {
      /* leave stats null -> zeros */
    }
  };

  // Default the right-hand detail panel to the most recent report.
  useEffect(() => {
    if (!selectedReport && reports.length > 0) {
      setSelectedReport(reports[0]);
    }
  }, [reports, selectedReport]);

  const activeReport = selectedReport;
  const findings = useMemo(
    () => (activeReport ? deriveFindings(activeReport) : []),
    [activeReport]
  );

  const filteredFindings = useMemo(() => {
    if (severityFilter === "all") return findings;
    if (severityFilter === "critical")
      return findings.filter((f) => f.severity === "critical");
    if (severityFilter === "high")
      return findings.filter(
        (f) => f.severity === "high" || f.severity === "critical"
      );
    return findings.filter((f) => f.severity === "medium");
  }, [findings, severityFilter]);

  const visibleFindings = filteredFindings.slice(0, 8);
  const remaining = filteredFindings.length - visibleFindings.length;

  /* ---- tile values: prefer stats endpoint, else zeros ---- */
  const tileTotal = stats?.totalReports ?? 0;
  const tileCritical = stats?.findings.highFindings ?? 0;
  const tileMedium = stats?.findings.mediumFindings ?? 0;
  const tileResolved = stats?.completedReports ?? 0;

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[104px] bg-[#131315] border border-[#27272a] rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#4be277]" />
        </div>
      </div>
    );
  }

  /* ---------- error ---------- */
  if (error) {
    return (
      <div className="bg-[#131315] border border-[#ef4444]/30 rounded-xl p-6">
        <div className="flex items-center gap-2 text-[#ef4444] mb-3">
          <XCircle className="h-5 w-5" />
          <span className="font-semibold">Error Loading Reports</span>
        </div>
        <p className="text-[#bccbb9] mb-4 text-sm">{error}</p>
        <button
          onClick={fetchReports}
          className="px-4 py-2 rounded-lg border border-[#3f3f46] text-[#e5e1e4] text-sm hover:bg-[#27272a] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const statTiles = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatTile
        label="TOTAL SCANS"
        value={tileTotal}
        color="#bccbb9"
        Icon={History}
        hoverBorder="hover:border-[#3f3f46]"
      />
      <StatTile
        label="CRITICAL FINDINGS"
        value={tileCritical}
        color="#ef4444"
        Icon={AlertOctagon}
        hoverBorder="hover:border-[#ef4444]/50"
      />
      <StatTile
        label="MEDIUM FINDINGS"
        value={tileMedium}
        color="#f59e0b"
        Icon={AlertTriangle}
        hoverBorder="hover:border-[#f59e0b]/50"
      />
      <StatTile
        label="RESOLVED"
        value={tileResolved}
        color="#4be277"
        Icon={CheckCircle2}
        hoverBorder="hover:border-[#22C55E]/50"
      />
    </div>
  );

  /* ---------- empty ---------- */
  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        {statTiles}
        <div className="bg-[#131315] border border-[#27272a] rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <ShieldCheck className="h-10 w-10 text-[#4be277] mb-4 opacity-70" />
          <p className="text-[#e5e1e4] font-semibold mb-1">No reports yet</p>
          <p className="text-[#bccbb9] text-sm">
            Run a workflow to generate security scan reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statTiles}

      <div className="grid grid-cols-12 gap-6 xl:h-[calc(100vh-15rem)] xl:min-h-0">
        {/* ----- Left: Recent Reports list (independent scroll) ----- */}
        <div className="col-span-12 xl:col-span-4 space-y-4 xl:overflow-y-auto xl:min-h-0 xl:pr-1">
          <h2
            className="text-[11px] tracking-wide text-[#bccbb9] sticky top-0 bg-[#09090b] py-1 z-10"
            style={{ fontFamily: GEIST }}
          >
            RECENT REPORTS
          </h2>

          {reports.map((report) => {
            const isActive = activeReport?._id === report._id;
            const counts = severityCounts(deriveFindings(report));
            const total =
              counts.critical +
              counts.high +
              counts.medium +
              counts.low +
              counts.info;
            const seg = (n) =>
              total > 0 ? `${(n / total) * 100}%` : "0%";
            const ts = report.startTime || report.createdAt;

            return (
              <div
                key={report._id}
                onClick={() => navigate(`/run/${report._id}`)}
                onMouseEnter={() => setSelectedReport(report)}
                className={`bg-[#131315] p-5 rounded-xl space-y-4 cursor-pointer transition-colors group ${
                  isActive
                    ? "border border-[#4be277]"
                    : "border border-[#27272a] hover:border-[#3f3f46] opacity-80 hover:opacity-100"
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#e5e1e4] truncate">
                      {report.workflowName || "Unnamed Workflow"}
                    </h3>
                    <p
                      className="text-xs text-[#bccbb9] mt-1 opacity-80 truncate"
                      style={{ fontFamily: GEIST }}
                    >
                      {report.targetUrl}
                    </p>
                  </div>
                  {statusChip(report.status)}
                </div>

                {/* severity stacked bar */}
                <div className="space-y-1">
                  <div
                    className="flex justify-between text-[10px] text-[#bccbb9]"
                    style={{ fontFamily: GEIST }}
                  >
                    SEVERITY DISTRIBUTION
                    {counts.critical + counts.high > 0 ? (
                      <span className="text-[#ef4444]">
                        {counts.critical + counts.high} CRITICAL
                      </span>
                    ) : (
                      <span className="text-[#bccbb9]">{total} TOTAL</span>
                    )}
                  </div>
                  <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-[#27272a]">
                    <div
                      style={{
                        width: seg(counts.critical + counts.high),
                        backgroundColor: SEVERITY_STYLES.critical.bar,
                      }}
                    />
                    <div
                      style={{
                        width: seg(counts.medium),
                        backgroundColor: SEVERITY_STYLES.medium.bar,
                      }}
                    />
                    <div
                      style={{
                        width: seg(counts.low),
                        backgroundColor: SEVERITY_STYLES.low.bar,
                      }}
                    />
                    <div
                      style={{
                        width: seg(counts.info),
                        backgroundColor: SEVERITY_STYLES.info.bar,
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span
                    className="text-[11px] text-[#bccbb9]"
                    style={{ fontFamily: GEIST }}
                  >
                    {ts ? new Date(ts).toLocaleString() : "—"}
                  </span>
                  <span
                    className={`text-[11px] flex items-center gap-1 transition-all ${
                      isActive ? "text-[#4be277]" : "text-[#bccbb9]"
                    }`}
                    style={{ fontFamily: GEIST }}
                  >
                    VIEW REPORT
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ----- Right: Vulnerability Findings table (independent scroll) ----- */}
        <div className="col-span-12 xl:col-span-8 bg-[#131315] border border-[#27272a] rounded-xl flex flex-col overflow-hidden xl:min-h-0">
          <div className="p-5 border-b border-[#27272a] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-bold text-[#e5e1e4] flex items-center gap-2">
                Vulnerability Findings
              </h2>
              <p className="text-sm text-[#bccbb9] truncate">
                {activeReport
                  ? `Detailed analysis for ${activeReport.workflowName || "report"}`
                  : "Select a report"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* severity filter */}
              <div className="flex items-center bg-[#09090b] border border-[#27272a] rounded-lg p-1">
                {(["critical", "high", "medium", "all"] ).map((f) => {
                  const isOn = severityFilter === f;
                  const labelMap = {
                    critical: "CRITICAL",
                    high: "HIGH",
                    medium: "MED",
                    all: "ALL",
                  };
                  return (
                    <button
                      key={f}
                      onClick={() => setSeverityFilter(f)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                        isOn
                          ? f === "critical"
                            ? "bg-[#ef4444] text-[#0b0b0d]"
                            : f === "medium"
                            ? "bg-[#f59e0b] text-[#0b0b0d]"
                            : "bg-[#27272a] text-[#e5e1e4]"
                          : "text-[#bccbb9] hover:text-[#e5e1e4]"
                      }`}
                      style={{ fontFamily: GEIST }}
                    >
                      {labelMap[f]}
                    </button>
                  );
                })}
              </div>

              <button
                className="flex items-center gap-2 bg-[#4be277] px-4 py-1.5 rounded-lg text-[#003915] text-sm font-bold transition-transform hover:scale-[1.02]"
                onClick={() => {
                  if (!activeReport) return;
                  const blob = new Blob(
                    [JSON.stringify({ report: activeReport, findings }, null, 2)],
                    { type: "application/json" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `report-${activeReport._id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" />
                EXPORT
              </button>
            </div>
          </div>

          {filteredFindings.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-8 w-8 text-[#4be277] mb-3 opacity-70" />
              <p className="text-[#bccbb9] text-sm">
                No findings for this report at the selected severity.
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-left">
                  <thead className="bg-[#09090b]/50 border-b border-[#27272a]">
                    <tr>
                      {["SEVERITY", "VULNERABILITY NAME", "LOCATION", "RECOMMENDATION", "ACTION"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-5 py-4 text-[11px] font-bold text-[#bccbb9]"
                            style={{ fontFamily: GEIST }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {visibleFindings.map((f, i) => {
                      const s = SEVERITY_STYLES[f.severity];
                      return (
                        <tr
                          key={i}
                          className="hover:bg-[#1c1b1d] transition-colors group"
                        >
                          <td className="px-5 py-5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.chip}`}
                              style={{ fontFamily: GEIST }}
                            >
                              {s.label}
                            </span>
                          </td>
                          <td className="px-5 py-5 font-bold text-[#e5e1e4] text-sm">
                            {f.name}
                          </td>
                          <td
                            className="px-5 py-5 text-xs text-[#bccbb9]"
                            style={{ fontFamily: GEIST }}
                          >
                            {f.location}
                          </td>
                          <td className="px-5 py-5 text-sm text-[#bccbb9] italic max-w-md">
                            {f.recommendation}
                          </td>
                          <td className="px-5 py-5">
                            <ExternalLink className="h-4 w-4 text-[#bccbb9] group-hover:text-[#4be277] transition-colors" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-[#0e0e10] flex justify-center">
                <span
                  className="text-xs font-bold text-[#bccbb9] flex items-center gap-2"
                  style={{ fontFamily: GEIST }}
                >
                  {remaining > 0
                    ? `LOAD FULL REPORT (${remaining} REMAINING)`
                    : "FULL REPORT LOADED"}
                  <ChevronDown className="h-4 w-4" />
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Execution errors surfaced from existing data */}
      {activeReport && activeReport.executionErrors.length > 0 && (
        <div className="bg-[#131315] border border-[#ef4444]/30 rounded-xl p-5">
          <div className="flex items-center gap-2 text-[#ef4444] mb-3">
            <AlertOctagon className="h-4 w-4" />
            <span className="font-semibold text-sm">Execution Errors</span>
          </div>
          <div className="space-y-2">
            {activeReport.executionErrors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-[#bccbb9]"
              >
                {statusIcon("failed")}
                <div>
                  <div className="text-[#e5e1e4] font-medium">
                    {err.nodeType || "General Error"}
                  </div>
                  <div>{err.message}</div>
                  <div
                    className="text-[11px] mt-0.5 opacity-70"
                    style={{ fontFamily: GEIST }}
                  >
                    {new Date(err.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
