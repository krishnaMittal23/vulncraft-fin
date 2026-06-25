import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Calendar,
  Play,
  Pencil,
  Trash2,
  FileText,
  FolderArchive,
  Network,
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Loader2,
  Activity,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useWorkflowSocket } from "@/hooks/useWorkflowSocket";
import { authHeaders } from "@/lib/api";
import { BACKEND_URL } from "@/lib/constant";

import CreateWorkflowDialog from "@/components/dashboard/workflow/CreateWorkflowDialog";
import EmptyState from "@/components/dashboard/workflow/EmptyState";
import { useWorkflowStore } from "@/lib/store";

const fontGeist = { fontFamily: "'Geist', sans-serif" } as const;
const fontMono = { fontFamily: "'JetBrains Mono', monospace" } as const;

type CardStatus = "running" | "completed" | "idle" | "failed";

const statusChipStyles: Record<
  CardStatus,
  { label: string; cls: string; dot: string }
> = {
  running: {
    label: "RUNNING",
    cls: "text-[#4be277] bg-[#22C55E]/10 border-[#22C55E]/40",
    dot: "bg-[#4be277]",
  },
  completed: {
    label: "COMPLETED",
    cls: "text-[#4be277] bg-[#22C55E]/10 border-[#22C55E]/40",
    dot: "bg-[#22C55E]",
  },
  idle: {
    label: "IDLE",
    cls: "text-[#bccbb9] bg-[#27272a]/60 border-[#3f3f46]",
    dot: "bg-[#bccbb9]/60",
  },
  failed: {
    label: "FAILED",
    cls: "text-[#f87171] bg-[#ef4444]/10 border-[#ef4444]/30",
    dot: "bg-[#ef4444]",
  },
};

const Workflow = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const {
    workflows,
    isLoading,
    error,
    fetchWorkflows,
    deleteWorkflow,
    setActiveWorkflow,
  } = useWorkflowStore();

  const { progress, joinWorkflow, leaveWorkflow, clearProgress } = useWorkflowSocket();
  const [executingWorkflowId, setExecutingWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Download logs handler (TXT format)
  const handleDownloadLogs = async () => {
    if (!progress?.reportId) {
      toast.error("No report available to download logs");
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/reports/${progress.reportId}/logs/download`, {
        headers: { ...authHeaders() },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Authentication required. Please log in again.");
          return;
        }
        throw new Error('Failed to download logs');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vulncraft-logs-${progress.reportId}-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Logs downloaded successfully");
    } catch (error) {
      console.error('Error downloading logs:', error);
      toast.error("Failed to download logs");
    }
  };

  // Download logs handler (ZIP format - organized by node)
  const handleDownloadLogsZip = async () => {
    if (!progress?.reportId) {
      toast.error("No report available to download logs");
      return;
    }

    try {
      toast.info("Preparing ZIP archive...");

      const response = await fetch(`${BACKEND_URL}/api/reports/${progress.reportId}/logs/download-zip`, {
        headers: { ...authHeaders() },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Authentication required. Please log in again.");
          return;
        }
        if (response.status === 404) {
          toast.error("No logs available for this report");
          return;
        }
        throw new Error('Failed to download logs');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vulncraft-logs-${progress.reportId}-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("ZIP archive downloaded successfully");
    } catch (error) {
      console.error('Error downloading logs ZIP:', error);
      toast.error("Failed to download logs");
    }
  };

  // Clean up when workflow execution completes
  useEffect(() => {
    if (progress && (progress.status === 'completed' || progress.status === 'failed')) {
      // Show completion notification
      if (progress.status === 'completed') {
        toast.success("Workflow completed successfully!", {
          description: `Total findings: ${progress.findings?.total || 0}. Check the Reports tab for detailed results.`,
        });
      } else if (progress.status === 'failed') {
        toast.error("Workflow execution failed", {
          description: progress.error || "Unknown error occurred",
        });
      }

      // Leave the workflow room and reset state after a delay
      const t = setTimeout(() => {
        if (executingWorkflowId) {
          leaveWorkflow(executingWorkflowId);
          setExecutingWorkflowId(null);
        }
      }, 10000); // Keep showing progress for 10 seconds after completion
      return () => clearTimeout(t);
    }
  }, [progress, executingWorkflowId, leaveWorkflow]);

  const handleCreateWorkflow = () => {
    setDialogOpen(true);
  };

  const handleDeleteWorkflow = async (
    id: string,
    name: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteWorkflow(id);
        toast.success("Workflow deleted", {
          description: `${name} has been deleted successfully.`,
        });
      } catch (error) {
        // Error is already handled in the store with a toast
      }
    }
  };

  const handleEditWorkflow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveWorkflow(id);
    navigate(`/workflow/${id}`);
  };

  const handleCardClick = (id: string) => {
    setActiveWorkflow(id);
    navigate(`/workflow/${id}`);
  };

  const handleExecuteWorkflow = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Clear any previous progress
      clearProgress();
      setExecutingWorkflowId(id);

      // Join the workflow room for real-time updates
      joinWorkflow(id);

      toast.info("Executing workflow", {
        description: `${name} is starting...`,
      });

      const response = await fetch(`${BACKEND_URL}/api/workflows/${id}/execute`, {
        method: "POST",
        headers: { ...authHeaders() },
      });

      if (!response.ok) {
        throw new Error("Failed to execute workflow");
      }

      toast.success("Workflow started", {
        description: `${name} is now running. Real-time progress will be shown below.`,
      });
    } catch (error) {
      // Leave the workflow room on error
      leaveWorkflow(id);
      setExecutingWorkflowId(null);

      toast.error("Execution failed", {
        description: error instanceof Error ? error.message : "Failed to start workflow",
      });
    }
  };

  const filteredWorkflows = workflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Derive a presentation status for a card. Only the workflow currently being
  // executed has a live status (driven by the socket `progress`); others are idle.
  const cardStatusFor = (id: string): CardStatus => {
    if (executingWorkflowId === id && progress) {
      if (progress.status === "completed") return "completed";
      if (progress.status === "failed") return "failed";
      if (progress.status === "running") return "running";
    }
    return "idle";
  };

  // Eyebrow label derived from execution mode (no `type` field on the data model).
  const eyebrowFor = (executionMode?: string) =>
    `// ${(executionMode || "PIPELINE").toUpperCase()}`;

  const relativeUpdated = (date: string) => {
    try {
      return `${formatDistanceToNow(new Date(date))} ago`;
    } catch {
      return format(new Date(date), "MMM d, yyyy");
    }
  };

  // Build the execution-progress timeline from the live socket data.
  const completedNodes = progress?.completedNodes ?? [];
  const remainingNodes = progress
    ? Math.max(progress.totalNodes - completedNodes.length - 1, 0)
    : 0;

  const formatDuration = (ms?: number) => {
    if (ms === undefined) return "";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <>
      <div
        className="min-h-screen bg-[#09090b] text-[#e5e1e4]"
        style={fontGeist}
      >
        <div className="container mx-auto px-6 pt-20 pb-12">
          <div className="flex flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Workflows</h1>
                <p className="mt-1 text-[#bccbb9]">
                  Build and run your drag-and-drop security pipelines
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#bccbb9]" />
                  <input
                    type="text"
                    placeholder="Search pipelines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 rounded-xl border border-[#27272a] bg-[#131315] py-2 pl-10 pr-4 text-sm text-[#e5e1e4] placeholder:text-[#bccbb9]/60 transition-colors focus:border-[#4be277] focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleCreateWorkflow}
                  className="flex items-center gap-2 rounded-xl bg-[#4be277] px-5 py-2.5 font-bold text-[#003915] transition-all hover:brightness-110 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  New Workflow
                </button>
              </div>
            </div>

            {/* Loading and error states */}
            {isLoading && (
              <div className="flex justify-center py-16">
                <p className="flex items-center gap-2 text-[#bccbb9]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading workflows...
                </p>
              </div>
            )}

            {error && !isLoading && (
              <div className="flex justify-center py-16">
                <div className="text-center">
                  <p className="mb-3 text-[#f87171]">{error}</p>
                  <button
                    onClick={() => fetchWorkflows()}
                    className="rounded-xl border border-[#3f3f46] px-4 py-2 text-sm text-[#e5e1e4] transition-colors hover:border-[#4be277] hover:text-[#4be277]"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {!isLoading && !error && (
              <>
                {workflows.length === 0 ? (
                  <div className="flex justify-center py-16">
                    <EmptyState
                      title="No workflows yet"
                      description="Create your first workflow to get started."
                      buttonText="Create Workflow"
                      onClick={handleCreateWorkflow}
                      icon={<Calendar className="h-8 w-8" />}
                    />
                  </div>
                ) : filteredWorkflows.length === 0 ? (
                  <div className="flex justify-center py-16">
                    <EmptyState
                      title="No matching workflows"
                      description={`No workflows found matching "${searchTerm}"`}
                      icon={<Search className="h-8 w-8" />}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-8">
                    {/* Workflow cards grid */}
                    <div className="col-span-12 lg:col-span-8">
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {filteredWorkflows.map((workflow) => {
                          const status = cardStatusFor(workflow.id);
                          const chip = statusChipStyles[status];
                          const isRunning = status === "running";
                          return (
                            <div
                              key={workflow.id}
                              onClick={() => handleCardClick(workflow.id)}
                              className={`group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-xl border bg-[#131315] p-6 transition-all hover:-translate-y-0.5 ${
                                isRunning
                                  ? "border-[#4be277]/40 hover:border-[#4be277]"
                                  : status === "failed"
                                    ? "border-[#ef4444]/20 hover:border-[#ef4444]/40"
                                    : "border-[#27272a] hover:border-[#3f3f46]"
                              }`}
                            >
                              {/* Eyebrow + status chip */}
                              <div className="flex items-start justify-between">
                                <span
                                  className="rounded bg-[#27272a]/60 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-[#bccbb9]"
                                  style={fontMono}
                                >
                                  {eyebrowFor(workflow.executionMode)}
                                </span>
                                <div
                                  className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-widest ${chip.cls}`}
                                  style={fontMono}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${chip.dot} ${
                                      isRunning ? "animate-pulse" : ""
                                    }`}
                                  />
                                  {chip.label}
                                </div>
                              </div>

                              {/* Name + description */}
                              <div>
                                <h3 className="text-xl font-bold text-[#e5e1e4] transition-colors group-hover:text-[#4be277]">
                                  {workflow.name}
                                </h3>
                                <p className="mt-1 line-clamp-2 text-sm text-[#bccbb9]">
                                  Drag-and-drop security pipeline with {workflow.nodes.length} configured node
                                  {workflow.nodes.length === 1 ? "" : "s"}.
                                </p>
                              </div>

                              {/* Meta chips */}
                              <div className="mt-auto flex gap-4">
                                <div className="flex items-center gap-1.5">
                                  <Network className="h-4 w-4 text-[#bccbb9]" />
                                  <span className="text-sm text-[#bccbb9]" style={fontMono}>
                                    {workflow.nodes.length} Nodes
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4 text-[#bccbb9]" />
                                  <span className="text-sm text-[#bccbb9]" style={fontMono}>
                                    {relativeUpdated(workflow.updatedAt)}
                                  </span>
                                </div>
                              </div>

                              {/* Footer actions */}
                              <div className="flex items-center justify-between border-t border-[#27272a] pt-4">
                                <div className="flex gap-3">
                                  <button
                                    title="Run"
                                    onClick={(e) =>
                                      handleExecuteWorkflow(workflow.id, workflow.name, e)
                                    }
                                    className="text-[#4be277] transition-transform hover:scale-110"
                                  >
                                    <Play className="h-5 w-5" />
                                  </button>
                                  <button
                                    title="Edit"
                                    onClick={(e) => handleEditWorkflow(workflow.id, e)}
                                    className="text-[#bccbb9] transition-colors hover:text-[#e5e1e4]"
                                  >
                                    <Pencil className="h-5 w-5" />
                                  </button>
                                  <button
                                    title="Delete"
                                    onClick={(e) =>
                                      handleDeleteWorkflow(workflow.id, workflow.name, e)
                                    }
                                    className="text-[#bccbb9] transition-colors hover:text-[#f87171]"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                </div>
                                <span
                                  className="text-[11px] uppercase text-[#bccbb9]/50"
                                  style={fontMono}
                                >
                                  {format(new Date(workflow.createdAt), "MMM d, yyyy")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Execution Progress panel */}
                    <div className="col-span-12 flex h-fit flex-col gap-4 lg:col-span-4">
                      <div className="flex h-[600px] flex-col rounded-xl border border-[#27272a] bg-[#18181b]/60 p-6 backdrop-blur-md">
                        <div className="mb-6 flex items-center justify-between">
                          <h4 className="flex items-center gap-2 text-lg font-bold">
                            <Activity className="h-5 w-5 text-[#4be277]" />
                            Execution Progress
                          </h4>
                          {progress && (
                            <span
                              className="rounded border border-[#4be277]/30 px-2 py-0.5 text-[11px] text-[#4be277]"
                              style={fontMono}
                            >
                              {progress.status.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-2">
                          {!progress ? (
                            <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-[#bccbb9]/70">
                              <Activity className="mb-3 h-8 w-8 text-[#3f3f46]" />
                              No active execution. Run a workflow to watch its
                              nodes execute in real time.
                            </div>
                          ) : (
                            <>
                              {/* Completed / failed nodes */}
                              {completedNodes.map((node, index) => {
                                const isFailed = node.status === "failed";
                                return (
                                  <div
                                    key={`${node.nodeId}-${index}`}
                                    className="relative flex gap-4"
                                  >
                                    <div className="absolute bottom-[-24px] left-[11px] top-6 w-px bg-[#27272a]" />
                                    <div
                                      className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full ${
                                        isFailed ? "bg-[#ef4444]" : "bg-[#4be277]"
                                      }`}
                                    >
                                      {isFailed ? (
                                        <XCircle className="h-3.5 w-3.5 text-[#09090b]" />
                                      ) : (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-[#003915]" />
                                      )}
                                    </div>
                                    <div className="flex-1 pb-2">
                                      <div className="flex items-center justify-between">
                                        <p
                                          className="font-bold text-[#e5e1e4]"
                                          style={fontMono}
                                        >
                                          {node.nodeType}
                                        </p>
                                        <span
                                          className="text-[11px] text-[#bccbb9]"
                                          style={fontMono}
                                        >
                                          {formatDuration(node.duration)}
                                        </span>
                                      </div>
                                      {isFailed && node.error && (
                                        <p className="text-[13px] text-[#f87171]">
                                          {node.error}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Currently running node */}
                              {progress.status === "running" && progress.currentNode && (
                                <div className="relative flex gap-4">
                                  <div className="absolute bottom-[-24px] left-[11px] top-6 w-px bg-[#27272a]" />
                                  <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#4be277] bg-[#09090b]">
                                    <div className="h-2 w-2 animate-pulse rounded-full bg-[#4be277]" />
                                  </div>
                                  <div className="flex-1 pb-2">
                                    <div className="flex items-center justify-between text-[#4be277]">
                                      <p className="font-bold" style={fontMono}>
                                        {progress.currentNode.nodeType}
                                      </p>
                                      <span className="text-[11px]" style={fontMono}>
                                        In Progress
                                      </span>
                                    </div>
                                    {progress.currentNode.executionLevel && (
                                      <p className="text-[13px] text-[#4be277]/80">
                                        Level {progress.currentNode.executionLevel}
                                        {progress.currentNode.mode === "parallel"
                                          ? " (Parallel)"
                                          : ""}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Pending node summary */}
                              {remainingNodes > 0 && (
                                <div className="relative flex gap-4">
                                  <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#27272a] bg-[#0e0e10]">
                                    <MoreHorizontal className="h-3.5 w-3.5 text-[#bccbb9]/60" />
                                  </div>
                                  <div className="flex-1 pb-2 opacity-40">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[#e5e1e4]" style={fontMono}>
                                        {remainingNodes} node
                                        {remainingNodes === 1 ? "" : "s"} pending
                                      </p>
                                      <span className="text-[11px]" style={fontMono}>
                                        Pending
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Failure message */}
                              {progress.status === "failed" && progress.error && (
                                <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
                                  <p className="text-sm font-bold text-[#f87171]">
                                    Execution failed
                                  </p>
                                  <p className="mt-1 text-xs text-[#f87171]/80">
                                    {progress.error}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Download actions */}
                        <div className="mt-6 flex flex-col gap-2 border-t border-[#27272a] pt-6">
                          {progress?.reportId && (
                            <button
                              onClick={() => navigate(`/run/${progress.reportId}`)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4be277] py-2.5 font-bold text-[#003915] transition-all hover:brightness-110 active:scale-95"
                            >
                              <Activity className="h-5 w-5" />
                              View detailed run
                            </button>
                          )}
                          <button
                            onClick={handleDownloadLogs}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#3f3f46] py-2.5 text-[#bccbb9] transition-colors hover:bg-[#27272a]/40 hover:text-[#e5e1e4]"
                          >
                            <FileText className="h-5 w-5" />
                            Download logs
                          </button>
                          <button
                            onClick={handleDownloadLogsZip}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#3f3f46] py-2.5 text-[#bccbb9] transition-colors hover:bg-[#27272a]/40 hover:text-[#e5e1e4]"
                          >
                            <FolderArchive className="h-5 w-5" />
                            Download ZIP
                          </button>
                        </div>
                      </div>

                      {/* Active monitoring footnote */}
                      <div className="flex items-center gap-4 rounded-xl border border-[#4be277]/20 bg-[#4be277]/5 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4be277]/20">
                          <Info className="h-5 w-5 text-[#4be277]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#4be277]">
                            Active monitoring enabled
                          </p>
                          <p className="text-xs text-[#4be277]/70">
                            Nodes execute in a restricted sandbox environment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <CreateWorkflowDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};

export default Workflow;
