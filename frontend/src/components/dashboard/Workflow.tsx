import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Calendar,
  ArrowRight,
  MoreVertical,
  Edit,
  Trash,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useWorkflowSocket } from "@/hooks/useWorkflowSocket";
import { WorkflowProgressViewer } from "@/components/shared/WorkflowProgressViewer";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreateWorkflowDialog from "@/components/dashboard/workflow/CreateWorkflowDialog";
import EmptyState from "@/components/dashboard/workflow/EmptyState";
import { useWorkflowStore } from "@/lib/store";

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

  const { isConnected, progress, joinWorkflow, leaveWorkflow, clearProgress } = useWorkflowSocket();
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
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      const response = await fetch(`${BACKEND_URL}/api/reports/${progress.reportId}/logs/download`, {
        credentials: 'include', // Use cookie-based auth
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
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      toast.info("Preparing ZIP archive...");
      
      const response = await fetch(`${BACKEND_URL}/api/reports/${progress.reportId}/logs/download-zip`, {
        credentials: 'include', // Use cookie-based auth
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
      setTimeout(() => {
        if (executingWorkflowId) {
          leaveWorkflow(executingWorkflowId);
          setExecutingWorkflowId(null);
        }
      }, 10000); // Keep showing progress for 10 seconds after completion
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

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/workflows/${id}/execute`, {
        method: "POST",
        credentials: "include",
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

  return (
    <>
      <div className="container mx-auto px-4 pt-20 pb-10">
        <div className="flex flex-col space-y-8 animate-fade-in">
          {/* Page header */}
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
            <div className="flex gap-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 max-w-xs"
                />
              </div>
              <Button onClick={handleCreateWorkflow}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          </div>

          {/* Real-time Workflow Progress */}
          {progress && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Execution Progress</h2>
              <WorkflowProgressViewer 
                progress={progress} 
                onDownloadLogs={handleDownloadLogs}
                onDownloadLogsZip={handleDownloadLogsZip}
              />
            </div>
          )}

          {/* Loading and error states */}
          {isLoading && (
            <div className="flex justify-center py-16">
              <p className="text-muted-foreground">Loading workflows...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex justify-center py-16">
              <div className="text-center">
                <p className="text-destructive mb-2">{error}</p>
                <Button variant="outline" onClick={() => fetchWorkflows()}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Workflows list */}
          {!isLoading && !error && (
            <>
              {" "}
              {/* Workflows list */}
              {workflows.length === 0 ? (
                <div className="flex justify-center py-16">
                  <EmptyState
                    title="No workflows yet"
                    description="Create your first workflow to get started."
                    buttonText="Create Workflow"
                    onClick={handleCreateWorkflow}
                    icon={<Calendar className="w-8 h-8" />}
                  />
                </div>
              ) : filteredWorkflows.length === 0 ? (
                <div className="flex justify-center py-16">
                  <EmptyState
                    title="No matching workflows"
                    description={`No workflows found matching "${searchTerm}"`}
                    icon={<Search className="w-8 h-8" />}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredWorkflows.map((workflow) => (
                    <Card
                      key={workflow.id}
                      className="overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer group bg-gradient-to-br from-background to-muted/50 border-muted/30"
                      onClick={() => handleCardClick(workflow.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-primary" />
                              </div>
                              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                                {workflow.name}
                              </h3>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                              {format(
                                new Date(workflow.createdAt),
                                "MMM d, yyyy"
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) =>
                                  handleEditWorkflow(
                                    workflow.id,
                                    e as React.MouseEvent
                                  )
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) =>
                                  handleDeleteWorkflow(
                                    workflow.id,
                                    workflow.name,
                                    e as React.MouseEvent
                                  )
                                }
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                      <CardFooter className="px-6 py-4 border-t border-muted/20 bg-muted/5">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-xs text-muted-foreground">
                              Active
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs hover:text-green-600 transition-colors"
                              onClick={(e) => handleExecuteWorkflow(workflow.id, workflow.name, e)}
                            >
                              <Play className="w-3.5 h-3.5 mr-1" />
                              Execute
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs group-hover:text-primary transition-colors hover:bg-transparent"
                            >
                              Open workflow
                              <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-1" />
                            </Button>
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <CreateWorkflowDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};

export default Workflow;
