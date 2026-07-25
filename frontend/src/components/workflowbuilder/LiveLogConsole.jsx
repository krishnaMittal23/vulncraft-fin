import { useEffect, useRef, useState } from "react";
import { Terminal, X, ChevronDown, ChevronUp, Circle, PanelRightOpen } from "lucide-react";

const mono = { fontFamily: "'JetBrains Mono', monospace" };

const LEVEL_COLOR = {
  error: "text-red-400",
  warning: "text-amber-400",
  warn: "text-amber-400",
  info: "text-[#bccbb9]",
  docker: "text-purple-400",
  success: "text-[#4be277]",
};

const STATUS_META = {
  running: {
    label: "RUNNING",
    dot: "text-[#4be277]",
    text: "text-[#4be277]",
  },
  completed: {
    label: "COMPLETED",
    dot: "text-[#6ee7b7]",
    text: "text-[#6ee7b7]",
  },
  failed: {
    label: "FAILED",
    dot: "text-[#ef4444]",
    text: "text-[#ef4444]",
  },
  idle: {
    label: "IDLE",
    dot: "text-[#3f3f46]",
    text: "text-[#bccbb9]",
  },
};

const fmtTime = (t) =>
  new Date(t).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

const LiveLogConsole = ({ progress, onClose, onShowDetails }) => {
  const [collapsed, setCollapsed] = useState(false);
  const endRef = useRef(null);
  const logs = progress?.logs || [];
  const status = progress?.status || "idle";
  const meta = STATUS_META[status] || STATUS_META.idle;
  const total = progress?.totalNodes ? progress.totalNodes - 1 : 0;
  const done = progress?.completedNodes?.length || 0;

  useEffect(() => {
    if (!collapsed) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, collapsed]);

  return (
    <div
      className="pointer-events-auto absolute bottom-6 left-4 z-50 w-[min(460px,42vw)] rounded-xl border border-[#27272a] bg-[#0c0c0e]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden"
      style={{ fontFamily: "'Geist', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#27272a] bg-[#131315]/80">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="h-4 w-4 text-[#4be277] shrink-0" />
          <span className="text-xs font-semibold text-[#e5e1e4]">Execution Logs</span>
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider shrink-0" style={mono}>
            <Circle className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} fill="currentColor" />
            <span className={meta.text}>{meta.label}</span>
          </span>
          {total > 0 && (
            <span className="text-[10px] text-[#bccbb9]/60 shrink-0" style={mono}>
              {done}/{total} nodes
            </span>
          )}
          {typeof progress?.duration === "number" && (
            <span className="text-[10px] text-[#bccbb9]/50 shrink-0" style={mono}>
              {(progress.duration / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onShowDetails && (
            <button
              onClick={onShowDetails}
              title="Open the full run view"
              className="flex items-center gap-1 rounded-md border border-[#4be277]/30 bg-[#4be277]/10 px-2 py-1 text-[10px] font-semibold text-[#4be277] hover:bg-[#4be277]/20 transition-colors"
              style={mono}
            >
              <PanelRightOpen className="h-3 w-3" /> Full run
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand" : "Collapse"}
            className="p-1 rounded text-[#bccbb9]/70 hover:bg-[#201f22] hover:text-[#4be277] transition-colors"
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 rounded text-[#bccbb9]/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="h-72 overflow-y-auto px-3 py-2 space-y-0.5 text-xs leading-relaxed" style={mono}>
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[#bccbb9]/40 text-[11px]">
              Waiting for the first log line…
            </div>
          ) : (
            <>
              {logs.map((log, i) => {
                const color = LEVEL_COLOR[(log.level || "info").toLowerCase()] || "text-[#bccbb9]";
                return (
                  <div key={`${log.timestamp}-${i}`} className="flex items-start gap-2">
                    <span className="text-[#52525b] shrink-0">{fmtTime(log.timestamp)}</span>
                    <span className={`shrink-0 uppercase text-[9px] mt-[2px] ${color}`}>
                      {(log.level || "info").slice(0, 4)}
                    </span>
                    {log.nodeType && (
                      <span className="shrink-0 text-[9px] mt-[2px] px-1 rounded bg-[#4be277]/10 text-[#4be277]">
                        {log.nodeType}
                      </span>
                    )}
                    <span className="flex-1 break-words text-[#d4d4d8]">{log.message}</span>
                  </div>
                );
              })}
              <div ref={endRef} />
            </>
          )}
        </div>
      )}

      {/* Footer live indicator */}
      {!collapsed && status === "running" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-[#27272a] text-[10px] text-[#4be277]" style={mono}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#4be277] animate-pulse" />
          live streaming · {logs.length} lines
        </div>
      )}
    </div>
  );
};

export default LiveLogConsole;
