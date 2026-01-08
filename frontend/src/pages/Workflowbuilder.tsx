import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  useReactFlow,
  MarkerType,
  ReactFlowProvider,
} from "reactflow";
import type {
  Connection,
  NodeTypes,
  NodeMouseHandler,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash, X } from "lucide-react";
import { useTheme } from "@/components/shared/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TriggerNode from "@/components/workflowbuilder/TriggerNode";
import WorkflowNode from "@/components/workflowbuilder/WorkflowNode";
import EmptyState from "@/components/dashboard/workflow/EmptyState";
import NodeConfigDialog from "@/components/workflowbuilder/NodeConfigDialog";
import OWASPNodeConfigDialog from "@/components/workflowbuilder/OWASPNodeConfigDialog";
import { ExecutionFlowIndicator } from "@/components/workflowbuilder/ExecutionFlowIndicator";
import { useWorkflowStore } from "@/lib/store";
import type {
  DataSource,
  Workflow,
  NodeType,
  WorkflowNode as WorkflowNodeType,
} from "@/types/workflow";
import { v4 as uuidv4 } from "uuid";

import "reactflow/dist/style.css";
import useAuth from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowProgressViewer } from "@/components/shared/WorkflowProgressViewer";
import { useWorkflowSocket } from "@/hooks/useWorkflowSocket";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  gobuster: WorkflowNode,
  nikto: WorkflowNode,
  nmap: WorkflowNode,
  sqlmap: WorkflowNode,
  wpscan: WorkflowNode,
  "owasp-vulnerabilities": WorkflowNode,
  "owasp-zap": WorkflowNode,
  "owasp-baseline": WorkflowNode,
  "owasp-dependency-check": WorkflowNode,
  "flow-chart": WorkflowNode,
  email: WorkflowNode,
  "github-issue": WorkflowNode,
  slack: WorkflowNode,
};

const TERMINAL_NODE_TYPES = ["email", "github-issue", "slack"];
const OWASP_NODE_TYPES = ["owasp-vulnerabilities", "owasp-zap", "owasp-baseline", "owasp-dependency-check"];

const WorkflowBuilderContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    workflows,
    fetchWorkflowById,
    updateWorkflow,
    setActiveWorkflow,
    activeDataSource,
    setActiveDataSource,
    isLoading,
    error,
  } = useWorkflowStore();

  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configNodeType, setConfigNodeType] = useState<NodeType | null>(null);
  const [configNodeData, setConfigNodeData] = useState<any>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showOWASPConfigDialog, setShowOWASPConfigDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI Agent prompt state
  const [prompt, setPrompt] = useState("");
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [isPromptPanelCollapsed, setIsPromptPanelCollapsed] = useState(false);

  // Workflow execution progress tracking
  const { progress, joinWorkflow, clearProgress } = useWorkflowSocket();
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // Auto-open execution panel when workflow starts
  useEffect(() => {
    if (progress && progress.status !== 'idle') {
      setShowExecutionPanel(true);
    }
  }, [progress]);

  useEffect(() => {
    const loadWorkflow = async () => {
      if (id) {
        const found = workflows.find((w) => w.id === id);

        if (found) {
          setWorkflow(found);
          setActiveWorkflow(id);

          if (found.nodes.length > 0) {
            setNodes(found.nodes);
            setEdges(found.edges as Edge[]);

            const triggerNode = found.nodes.find(
              (node) => node.type === "trigger"
            );
            if (triggerNode && triggerNode.data?.dataSource) {
              setActiveDataSource(triggerNode.data.dataSource);
            }
          } else {
            addTriggerNode();
          }
        } else {
          const fetchedWorkflow = await fetchWorkflowById(id);

          if (fetchedWorkflow) {
            setWorkflow(fetchedWorkflow);
            setActiveWorkflow(id);

            if (fetchedWorkflow.nodes.length > 0) {
              setNodes(fetchedWorkflow.nodes);
              setEdges(fetchedWorkflow.edges as Edge[]);

              const triggerNode = fetchedWorkflow.nodes.find(
                (node) => node.type === "trigger"
              );
              if (triggerNode && triggerNode.data?.dataSource) {
                setActiveDataSource(triggerNode.data.dataSource);
              }
            } else {
              addTriggerNode();
            }
          } else {
            toast.error("Workflow not found");
            navigate("/");
          }
        }

        const triggerNode = found?.nodes.find(
          (node) => node.type === "trigger"
        );

        console.log(triggerNode);
      }
    };

    loadWorkflow();
  }, []);

  // Join workflow room for real-time updates
  useEffect(() => {
    if (workflow && (workflow._id || workflow.id)) {
      const workflowId = workflow._id || workflow.id;
      joinWorkflow(workflowId);
      return () => {
        clearProgress();
      };
    }
  }, [workflow, joinWorkflow, clearProgress]);

  // AI Agent: Handle prompt submission
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setPromptError(null);
    setIsPromptLoading(true);
    
    try {
      // Audit: Log prompt submission
      console.log(`[AUDIT] User '${user?.username || 'unknown'}' submitted prompt:`, prompt);

      // Call AI agent backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error("AI agent backend error");
      }

      const data = await response.json();
      if (!data.success || !data.message) {
        throw new Error(data.error || "No valid response from AI agent");
      }

      // Parse workflow JSON
      let llmResult;
      try {
        llmResult = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
      } catch (e) {
        throw new Error("AI agent response is not valid JSON");
      }

      if (!llmResult.nodes || !llmResult.edges) {
        throw new Error("AI agent did not return valid workflow structure");
      }

      // Security: Block internal/localhost targets
      const triggerNode = llmResult.nodes.find((n: any) => n.type === 'trigger');
      const url = triggerNode?.data?.sourceUrl || triggerNode?.data?.url;
      if (url && /^(https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])))/.test(url)) {
        console.warn(`[AUDIT] Blocked internal/localhost target: ${url}`);
        throw new Error("Internal or localhost targets are not allowed");
      }

      // Update React Flow state
      setNodes(llmResult.nodes);
      setEdges(llmResult.edges);

      // Save workflow
      let newWorkflow = workflow;
      if (!workflow) {
        // Create new workflow
        newWorkflow = {
          id: '',
          name: llmResult.name || `AI Workflow ${new Date().toLocaleString()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          nodes: llmResult.nodes,
          edges: llmResult.edges,
        };
        const created = await useWorkflowStore.getState().addWorkflow(newWorkflow);
        setWorkflow(created);
        newWorkflow = created;
        console.log(`[AUDIT] Workflow created:`, created);
      } else {
        // Update existing workflow
        const updated = {
          ...workflow,
          nodes: llmResult.nodes,
          edges: llmResult.edges,
          updatedAt: new Date().toISOString(),
        };
        await useWorkflowStore.getState().updateWorkflow(updated, user?.username);
        setWorkflow(updated);
        newWorkflow = updated;
        console.log(`[AUDIT] Workflow updated:`, updated);
      }

      // Trigger execution
      if (newWorkflow && (newWorkflow._id || newWorkflow.id)) {
        const workflowId = newWorkflow._id || newWorkflow.id;
        const execRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/workflows/${workflowId}/execute`, {
          method: "POST",
          credentials: 'include',
        });
        
        if (!execRes.ok) {
          console.error(`[AUDIT] Workflow execution failed for ${workflowId}`);
          throw new Error("Failed to start workflow execution");
        }
        
        const execData = await execRes.json();
        toast.success("Workflow execution started", {
          description: execData.message || "AI-generated workflow is running.",
        });
        console.log(`[AUDIT] Workflow execution started for ${workflowId}`);
      }

      // Reset prompt
      setPrompt("");
      
    } catch (err: any) {
      setPromptError(err.message || "Failed to contact AI agent");
      console.error(`[AUDIT] Error in prompt workflow:`, err);
    } finally {
      setIsPromptLoading(false);
    }
  };

  const addTriggerNode = useCallback(() => {
    const newNode: WorkflowNodeType = {
      id: `trigger-${uuidv4()}`,
      type: "trigger" as NodeType,
      position: { x: 250, y: 200 },
      data: { dataSource: "Domain", frequency: "2hr", sourceUrl: "" },
    };

    setNodes([newNode]);
    setActiveDataSource("Domain");
    return newNode;
  }, [setNodes, setActiveDataSource]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      if (!sourceNode || !targetNode) {
        return;
      }

      if (targetNode?.type === "trigger") {
        toast.error("Cannot connect to trigger node input");
        return;
      }

      if (TERMINAL_NODE_TYPES.includes(sourceNode.type as NodeType)) {
        toast.error("Terminal nodes cannot have outgoing connections");
        return;
      }

      // Check if this exact connection already exists
      const connectionExists = edges.some(
        (edge) => edge.source === connection.source && edge.target === connection.target
      );

      if (connectionExists) {
        toast.error("This connection already exists");
        return;
      }

      // Allow multiple outgoing connections for parallel execution
      // But still restrict multiple incoming connections to prevent conflicts
      const targetHasConnection = edges.some(
        (edge) => edge.target === connection.target
      );
      if (targetHasConnection) {
        toast.error("A node can only have one incoming connection");
        return;
      }

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      );

      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    },
    [setEdges, nodes, edges, reactFlowInstance]
  );

  const addNode = (type: NodeType) => {
    // Allow multiple terminal nodes (email, github-issue, slack) but restrict others to one instance
    if (!TERMINAL_NODE_TYPES.includes(type) && nodes.some((node) => node.type === type)) {
      toast.error(`A ${type} node already exists in this workflow`);
      return;
    }

    const triggerExists = nodes.some((node) => node.type === "trigger");
    if (!triggerExists) {
      addTriggerNode();
      toast.info("A trigger node has been added automatically");
      return;
    }

    const isNodeCompatible = checkNodeCompatibility(type, activeDataSource);
    if (!isNodeCompatible) {
      toast.error(
        `${type} is not compatible with ${activeDataSource} data source`
      );
      return;
    }

    // Calculate position for new node
    const existingNodesOfType = nodes.filter(node => node.type === type);
    const baseX = nodes.reduce((max, node) => Math.max(max, node.position.x), 0);
    
    // If it's a terminal node and there are existing ones, offset the Y position
    let positionX = baseX + 300;
    let positionY = 200;
    
    if (TERMINAL_NODE_TYPES.includes(type) && existingNodesOfType.length > 0) {
      // Stack terminal nodes vertically with some offset
      positionY = 200 + (existingNodesOfType.length * 150);
    }

    const newNode: WorkflowNodeType = {
      id: `${type}-${uuidv4()}`,
      type,
      position: { x: positionX, y: positionY },
      data: {},
    };

    setNodes((nodes) => [...nodes, newNode]);

    if (TERMINAL_NODE_TYPES.includes(type)) {
      setConfigNodeId(newNode.id);
      setConfigNodeType(type);
      setConfigNodeData({});
      setShowConfigDialog(true);
    } else if (OWASP_NODE_TYPES.includes(type)) {
      setConfigNodeId(newNode.id);
      setConfigNodeType(type);
      setConfigNodeData({});
      setShowOWASPConfigDialog(true);
    }

    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 100);
  };

  const checkNodeCompatibility = (
    nodeType: NodeType,
    dataSource: DataSource | null
  ) => {
    if (!dataSource) return false;

    // Find trigger node to check if DAST on GitHub is enabled
    const triggerNode = nodes.find((node) => node.type === "trigger");
    const enableDASTOnGithub = triggerNode?.data?.enableDASTOnGithub || false;

    if (dataSource === "Domain") {
      // Domain supports all DAST tools
      return [
        "gobuster",
        "nikto",
        "nmap",
        "sqlmap",
        "wpscan",
        "owasp-zap",
        "owasp-baseline", 
        "owasp-dependency-check",
        "email",
        "github-issue",
        "slack",
      ].includes(nodeType);
    } else if (dataSource === "GitHub") {
      // GitHub with DAST enabled supports both SAST and DAST tools
      if (enableDASTOnGithub) {
        return [
          // DAST tools (for deployed app)
          "gobuster",
          "nikto",
          "nmap",
          "sqlmap",
          "wpscan",
          "owasp-zap",
          "owasp-baseline",
          "owasp-dependency-check",
          // SAST tools (for code analysis)
          "flow-chart",
          "owasp-vulnerabilities",
          // Reporting
          "email",
          "github-issue",
          "slack",
        ].includes(nodeType);
      } else {
        // GitHub without DAST only supports SAST tools
        return [
          "flow-chart",
          "owasp-vulnerabilities",
          "owasp-zap",
          "owasp-baseline",
          "owasp-dependency-check",
          "email",
          "github-issue",
          "slack",
        ].includes(nodeType);
      }
    }

    return false;
  };

  /**
   * Automatically detect execution mode based on workflow structure
   * Returns "parallel" if there are nodes that can run independently, "sequential" otherwise
   */
  const detectExecutionMode = useCallback((): "sequential" | "parallel" => {
    if (nodes.length <= 2) return "sequential"; // Just trigger + 1 node

    // Build dependency graph to detect parallel opportunities
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    
    // Initialize
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    });
    
    // Build adjacency list and calculate in-degrees
    edges.forEach(edge => {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });
    
    // Check if there are any levels with multiple nodes (parallel opportunity)
    const queue: string[] = [];
    const visitedCount = new Set<string>();
    
    // Find all nodes with no incoming edges
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });
    
    while (queue.length > 0) {
      const currentLevelSize = queue.length;
      
      // If more than one node can run at the same level (excluding trigger), it's parallel
      const currentLevelNodes: WorkflowNodeType[] = [];
      for (let i = 0; i < currentLevelSize; i++) {
        const nodeId = queue.shift()!;
        const node = nodeMap.get(nodeId);
        if (node && node.type !== "trigger") {
          currentLevelNodes.push(node as WorkflowNodeType);
        }
        visitedCount.add(nodeId);
        
        // Process neighbors
        adjList.get(nodeId)?.forEach((neighborId: string) => {
          inDegree.set(neighborId, (inDegree.get(neighborId) || 0) - 1);
          if (inDegree.get(neighborId) === 0) {
            queue.push(neighborId);
          }
        });
      }
      
      // If we found a level with multiple executable nodes, it can be parallel
      if (currentLevelNodes.length > 1) {
        return "parallel";
      }
    }
    
    return "sequential";
  }, [nodes, edges]);

  const validateWorkflow = (): { valid: boolean; message: string } => {
    if (nodes.length === 0) {
      return { valid: false, message: "Workflow must have at least one node" };
    }

    const triggerNode = nodes.find((node) => node.type === "trigger");
    if (!triggerNode) {
      return { valid: false, message: "Workflow must have a trigger node" };
    }

    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(triggerNode.id);

    let prevSize = 0;
    while (prevSize !== connectedNodeIds.size) {
      prevSize = connectedNodeIds.size;

      edges.forEach((edge) => {
        if (connectedNodeIds.has(edge.source)) {
          connectedNodeIds.add(edge.target);
        }
      });
    }

    if (connectedNodeIds.size !== nodes.length) {
      return {
        valid: false,
        message: "All nodes must be connected to the workflow",
      };
    }

    const hasReportNode = nodes.some((node) =>
      TERMINAL_NODE_TYPES.includes(node.type as NodeType)
    );

    if (!hasReportNode) {
      return {
        valid: false,
        message:
          "Workflow must include at least one report node (Email, GitHub Issue, or Slack)",
      };
    }

    const nodesWithOutgoingConnections = new Set(
      edges.map((edge) => edge.source)
    );

    const leafNodes = nodes.filter(
      (node) =>
        !nodesWithOutgoingConnections.has(node.id) && node.type !== "trigger"
    );

    const nonTerminalLeafNodes = leafNodes.filter(
      (node) => !TERMINAL_NODE_TYPES.includes(node.type as NodeType)
    );

    if (nonTerminalLeafNodes.length > 0) {
      return {
        valid: false,
        message: `Non-terminal nodes ${nonTerminalLeafNodes
          .map((n) => n.type)
          .join(", ")} must have outgoing connections`,
      };
    }

    const terminalNodes = nodes.filter((node) =>
      TERMINAL_NODE_TYPES.includes(node.type as NodeType)
    );

    for (const node of terminalNodes) {
      if (node.type === "email" && !node.data?.config?.email) {
        return {
          valid: false,
          message: `Email node (${node.id}) must be configured with an email address`,
        };
      }
      if (node.type === "github-issue" && !node.data?.config?.repository && !node.data?.config?.repo) {
        return {
          valid: false,
          message: `GitHub Issue node (${node.id}) must be configured with a repository`,
        };
      }
      if (node.type === "slack" && !node.data?.config?.channel) {
        return {
          valid: false,
          message: `Slack node (${node.id}) must be configured with a channel`,
        };
      }
    }

    return { valid: true, message: "" };
  };

  const saveWorkflow = async () => {
    if (!workflow) return;

    const validation = validateWorkflow();
    if (!validation.valid) {
      toast.error("Cannot save workflow", {
        description: validation.message,
      });
      return;
    }

    setIsSaving(true);

    try {
      const detectedExecutionMode = detectExecutionMode();
      
      const updatedWorkflow: Workflow = {
        ...workflow,
        updatedAt: new Date().toISOString(),
        nodes: nodes as WorkflowNodeType[],
        edges: edges as Edge[],
        executionMode: detectedExecutionMode,
      };

      console.log(`🤖 Auto-detected execution mode: ${detectedExecutionMode}`);

      const triggerNode = updatedWorkflow.nodes.find(
        (node) => node.type === "trigger"
      );

      if (
        !triggerNode ||
        !triggerNode.data?.sourceUrl ||
        (!triggerNode.data.sourceUrl.startsWith("https://") && 
         !triggerNode.data.sourceUrl.startsWith("http://"))
      ) {
        toast.error("Trigger node must have a valid HTTP or HTTPS URL");
        return;
      }

      console.log(updatedWorkflow);

      await updateWorkflow(updatedWorkflow, user?.username);
      setWorkflow(updatedWorkflow);

      toast.success("Workflow saved", {
        description: "Your workflow has been saved successfully.",
      });
    } catch (error) {
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = () => {
    navigate("/dashboard/workflow");
  };

  const deleteSelectedNodes = () => {
    const selectedNodes = nodes.filter((node) => node.selected);

    const triggerSelected = selectedNodes.some(
      (node) => node.type === "trigger"
    );
    if (triggerSelected) {
      toast.error("Cannot delete the trigger node");
      return;
    }

    const nodeIdsToRemove = selectedNodes.map((node) => node.id);

    setNodes((nodes) =>
      nodes.filter((node) => !nodeIdsToRemove.includes(node.id))
    );

    setEdges((edges) =>
      edges.filter(
        (edge) =>
          !nodeIdsToRemove.includes(edge.source) &&
          !nodeIdsToRemove.includes(edge.target)
      )
    );

    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 100);
  };

  const clearAllNodesExceptTrigger = () => {
    const triggerNode = nodes.find((node) => node.type === "trigger");

    if (!triggerNode) {
      toast.error("No trigger node found");
      return;
    }

    setNodes([triggerNode]);
    setEdges([]);

    toast.success("Workflow cleared", {
      description: "All nodes except the trigger have been removed.",
    });

    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 100);
  };

  const getAvailableNodes = (): { type: NodeType; label: string; canAddMultiple?: boolean }[] => {
    if (!activeDataSource) return [];

    // Find trigger node to check if DAST on GitHub is enabled
    const triggerNode = nodes.find((node) => node.type === "trigger");
    const enableDASTOnGithub = triggerNode?.data?.enableDASTOnGithub || false;

    if (activeDataSource === "Domain") {
      return [
        { type: "gobuster", label: "Gobuster" },
        { type: "nikto", label: "Nikto" },
        { type: "nmap", label: "Nmap" },
        { type: "sqlmap", label: "SQLMap" },
        { type: "wpscan", label: "WPScan" },
        { type: "owasp-zap", label: "OWASP ZAP" },
        { type: "owasp-baseline", label: "OWASP Baseline" },
        { type: "owasp-dependency-check", label: "OWASP Dependency" },
        { type: "email", label: "Email", canAddMultiple: true },
        { type: "github-issue", label: "GitHub Issue", canAddMultiple: true },
        { type: "slack", label: "Slack", canAddMultiple: true },
      ];
    } else {
      // GitHub with DAST enabled
      if (enableDASTOnGithub) {
        return [
          // DAST tools (for deployed app)
          { type: "gobuster", label: "Gobuster (DAST)" },
          { type: "nikto", label: "Nikto (DAST)" },
          { type: "nmap", label: "Nmap (DAST)" },
          { type: "sqlmap", label: "SQLMap (DAST)" },
          { type: "wpscan", label: "WPScan (DAST)" },
          { type: "owasp-zap", label: "OWASP ZAP" },
          { type: "owasp-baseline", label: "OWASP Baseline" },
          { type: "owasp-dependency-check", label: "OWASP Dependency" },
          // SAST tools
          { type: "owasp-vulnerabilities", label: "OWASP Comprehensive (SAST)" },
          { type: "flow-chart", label: "Flow Chart" },
          // Reporting
          { type: "email", label: "Email", canAddMultiple: true },
          { type: "github-issue", label: "GitHub Issue", canAddMultiple: true },
          { type: "slack", label: "Slack", canAddMultiple: true },
        ];
      } else {
        // GitHub SAST only
        return [
          { type: "owasp-vulnerabilities", label: "OWASP Comprehensive" },
          { type: "owasp-zap", label: "OWASP ZAP" },
          { type: "owasp-baseline", label: "OWASP Baseline" },
          { type: "owasp-dependency-check", label: "OWASP Dependency" },
          { type: "flow-chart", label: "Flow Chart" },
          { type: "email", label: "Email", canAddMultiple: true },
          { type: "github-issue", label: "GitHub Issue", canAddMultiple: true },
          { type: "slack", label: "Slack", canAddMultiple: true },
        ];
      }
    }
  };

  const openNodeConfig = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    console.log(node.type);

    if (TERMINAL_NODE_TYPES.includes(node.type as NodeType)) {
      setConfigNodeId(nodeId);
      setConfigNodeType(node.type as NodeType);
      setConfigNodeData(node.data?.config || {});
      setShowConfigDialog(true);
    } else if (OWASP_NODE_TYPES.includes(node.type as NodeType)) {
      setConfigNodeId(nodeId);
      setConfigNodeType(node.type as NodeType);
      setConfigNodeData(node.data?.config || {});
      setShowOWASPConfigDialog(true);
    } else {
      toast.info("This node type doesn't have configuration options");
    }
  };

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const workflowNode = node as Node<WorkflowNodeType>;
      if (TERMINAL_NODE_TYPES.includes(workflowNode.type as NodeType) || 
          OWASP_NODE_TYPES.includes(workflowNode.type as NodeType)) {
        openNodeConfig(workflowNode.id);
      }
    },
    [openNodeConfig]
  );

  const saveNodeConfig = (configData: any) => {
    if (!configNodeId || !configNodeType) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === configNodeId) {
          if (configNodeType === "trigger") {
            return {
              ...node,
              data: configData, // Direct data for trigger
            };
          } else if (TERMINAL_NODE_TYPES.includes(configNodeType)) {
            return {
              ...node,
              data: {
                config: configData, // Wrapped in config for terminal nodes
              },
            };
          } else {
            return {
              ...node,
              data: {}, // Empty data for tool nodes
            };
          }
        }
        return node;
      })
    );
  };

  return (
    <>
      {/* AI Agent Prompt - Always visible at top */}
      <form onSubmit={handlePromptSubmit} className="w-full flex flex-col gap-2 bg-background/95 backdrop-blur-sm border-b sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setIsPromptPanelCollapsed(!isPromptPanelCollapsed)}>
          <label htmlFor="workflow-prompt" className="font-semibold text-sm flex items-center gap-2 cursor-pointer">
            <span className="text-xl">🤖</span>
            AI Security Workflow Agent
          </label>
          <button
            type="button"
            className="p-1 hover:bg-accent rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsPromptPanelCollapsed(!isPromptPanelCollapsed);
            }}
          >
            {isPromptPanelCollapsed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
        {!isPromptPanelCollapsed && (
          <div className="px-4 pb-4 space-y-2">
            <Textarea
              id="workflow-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g., 'scan http://testphp.vulnweb.com for owasp and send gmail' or 'full web security scan before deployment'"
              className="resize-none min-h-[60px] text-sm"
              disabled={isPromptLoading}
            />
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPromptLoading || !prompt.trim()} className="gap-2" size="sm">
                {isPromptLoading ? <span className="animate-spin">⏳</span> : <span>🚀</span>}
                {isPromptLoading ? "Generating..." : "Generate & Execute Workflow"}
              </Button>
              {promptError && <span className="text-destructive text-xs">{promptError}</span>}
            </div>
          </div>
        )}
      </form>

      <div ref={reactFlowWrapper} className="h-full w-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-50">
            <p className="text-lg font-medium">Loading workflow...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-50">
            <div className="text-center">
              <p className="text-destructive mb-4">{error}</p>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/workflow")}
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeDoubleClick={handleNodeDoubleClick}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="transition-all duration-300"
        >
          <Background
            className={`${theme === "dark" ? `bg-zinc-950` : `bg-white`}`}
            gap={16}
          />
          <Controls />

          <Panel
            position="top-left"
            className="ml-4 mt-4 flex items-center gap-2"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <h2 className="text-lg font-medium ml-2">
              {workflow?.name || "Workflow Builder"}
            </h2>

            <div className="ml-4 px-3 py-2 bg-background/80 backdrop-blur-sm border rounded-md">
              <ExecutionFlowIndicator nodes={nodes as WorkflowNodeType[]} edges={edges} />
            </div>
          </Panel>

          <Panel
            position="top-right"
            className="mr-4 mt-4 flex items-center gap-2"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={deleteSelectedNodes}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete selected nodes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={clearAllNodesExceptTrigger}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear all nodes except trigger</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Add Node
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Available Nodes</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {getAvailableNodes().map((node) => {
                    const nodeExists = nodes.some((n) => n.type === node.type);
                    const isDisabled = nodeExists && !node.canAddMultiple;
                    const nodeCount = nodes.filter((n) => n.type === node.type).length;
                    
                    return (
                      <DropdownMenuItem
                        key={node.type}
                        onClick={() => addNode(node.type)}
                        disabled={isDisabled}
                        className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{node.label}</span>
                          {node.canAddMultiple && nodeCount > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({nodeCount} added)
                            </span>
                          )}
                          {node.canAddMultiple && (
                            <span className="text-xs text-blue-600 ml-2">
                              +
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  {getAvailableNodes().length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Configure a trigger first
                    </div>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={saveWorkflow}
              className="gap-1.5"
              disabled={isSaving || isLoading}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Workflow"}
            </Button>
          </Panel>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <EmptyState
                title="Start building your workflow"
                description="Add a trigger node to get started"
                buttonText="Add Trigger"
                onClick={() => {
                  addTriggerNode();
                }}
              />
            </div>
          )}
        </ReactFlow>

        {/* Execution Progress & Logs - Removed from here */}
      </div>

      {/* Execution Panel - Side Sheet */}
      <Sheet open={showExecutionPanel} onOpenChange={setShowExecutionPanel}>
        <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Workflow Execution Progress</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {progress && progress.status !== 'idle' ? (
              <WorkflowProgressViewer progress={progress} />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No active execution. Start a workflow to see progress here.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NodeConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        nodeType={configNodeType || "email"}
        initialData={configNodeData}
        onSave={saveNodeConfig}
      />

      <OWASPNodeConfigDialog
        open={showOWASPConfigDialog}
        onOpenChange={setShowOWASPConfigDialog}
        nodeType={configNodeType || "owasp-zap"}
        initialData={configNodeData}
        onSave={saveNodeConfig}
      />
    </>
  );
};

const WorkflowBuilder = () => {
  return (
    <>
      <div className="h-screen pb-0">
        <div className="h-full w-full">
          <ReactFlowProvider>
            <WorkflowBuilderContent />
          </ReactFlowProvider>
        </div>
      </div>
    </>
  );
};

export default WorkflowBuilder;
