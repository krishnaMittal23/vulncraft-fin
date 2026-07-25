import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { authHeaders } from "@/lib/api";
import { BACKEND_URL } from "@/lib/constant";
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

import "reactflow/dist/style.css";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash, X, Sparkles, Rocket, Loader2, ChevronDown } from "lucide-react";
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
import ScanNodeConfigDialog from "@/components/workflowbuilder/ScanNodeConfigDialog";
import LiveLogConsole from "@/components/workflowbuilder/LiveLogConsole";
import { ExecutionFlowIndicator } from "@/components/workflowbuilder/ExecutionFlowIndicator";
import { useWorkflowStore } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";

import "reactflow/dist/style.css";
import useAuth from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowProgressViewer } from "@/components/shared/WorkflowProgressViewer";
import { useWorkflowSocket } from "@/hooks/useWorkflowSocket";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const nodeTypes = {
  trigger: TriggerNode,
  gobuster: WorkflowNode,
  nikto: WorkflowNode,
  nmap: WorkflowNode,
  sqlmap: WorkflowNode,
  wpscan: WorkflowNode,
  "web-hygiene": WorkflowNode,
  nuclei: WorkflowNode,
  "js-recon": WorkflowNode,
  "owasp-vulnerabilities": WorkflowNode,
  "owasp-zap": WorkflowNode,
  "owasp-baseline": WorkflowNode,
  "owasp-dependency-check": WorkflowNode,
  "code-scan": WorkflowNode,
  "flow-chart": WorkflowNode,
  email: WorkflowNode,
  "github-issue": WorkflowNode,
  slack: WorkflowNode,
};

const TERMINAL_NODE_TYPES = ["email", "github-issue", "slack"];
const OWASP_NODE_TYPES = ["owasp-vulnerabilities", "owasp-zap", "owasp-baseline", "owasp-dependency-check"];
const SCAN_TOOL_NODE_TYPES = ["gobuster", "nmap", "sqlmap", "wpscan", "nikto", "web-hygiene", "nuclei", "js-recon"];

const WorkflowBuilderContent = () => {
  const { id } = useParams(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const { workflows, isLoading, error, updateWorkflow, setActiveWorkflow, fetchWorkflowById } = useWorkflowStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflow, setWorkflow] = useState(null);
  const [activeDataSource, setActiveDataSource] = useState(null);

  const [configNodeId, setConfigNodeId] = useState(null);
  const [configNodeType, setConfigNodeType] = useState(null);
  const [configNodeData, setConfigNodeData] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showOWASPConfigDialog, setShowOWASPConfigDialog] = useState(false);
  const [showScanConfigDialog, setShowScanConfigDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI Agent prompt state
  const [prompt, setPrompt] = useState("");
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState(null);
  const [isPromptPanelCollapsed, setIsPromptPanelCollapsed] = useState(false);

  // Workflow execution progress tracking
  const { progress, joinWorkflow, clearProgress } = useWorkflowSocket();
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [showLogConsole, setShowLogConsole] = useState(false);

  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useReactFlow();

  // Auto-open execution panel when workflow starts
  useEffect(() => {
    if (progress && progress.status !== 'idle') {
      setShowLogConsole(true);
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
setEdges(found.edges || []);

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
setEdges(fetchedWorkflow.edges || []);

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
  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setPromptError(null);
    setIsPromptLoading(true);
    
    try {
      // Call AI agent backend
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST", headers: { ...authHeaders() },
        body: JSON.stringify({ message: prompt }),
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
      const triggerNode = llmResult.nodes.find((n) => n.type === 'trigger');
      const url = triggerNode?.data?.sourceUrl || triggerNode?.data?.url;
      if (url && /^(https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])))/.test(url)) {
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
      }

      // Trigger execution
      if (newWorkflow && (newWorkflow._id || newWorkflow.id)) {
        const workflowId = newWorkflow._id || newWorkflow.id;
        // Join the live-log room BEFORE execution starts so no logs are missed.
        joinWorkflow(workflowId);
        setShowLogConsole(true);
        const execRes = await fetch(`${BACKEND_URL}/api/workflows/${workflowId}/execute`, {
          method: "POST", headers: { ...authHeaders() },
        });
        
        if (!execRes.ok) {
          throw new Error("Failed to start workflow execution");
        }
        
        const execData = await execRes.json();
        toast.success("Workflow execution started", {
          description: execData.message || "AI-generated workflow is running.",
        });
      }

      // Reset prompt
      setPrompt("");
      
    } catch (err) {
      setPromptError(err.message || "Failed to contact AI agent");
      console.error("Error in prompt workflow:", err);
    } finally {
      setIsPromptLoading(false);
    }
  };

  const addTriggerNode = useCallback(() => {
    const newNode= {
      id: `trigger-${uuidv4()}`,
      type: "trigger" ,
      position: { x: 200, y: 200 },
      data: {},
    };

    setNodes([newNode]);
    setActiveDataSource("Domain");
    return newNode;
  }, [setNodes, setActiveDataSource]);

  const onConnect = useCallback((connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      if (!sourceNode || !targetNode) {
        return;
      }

      if (targetNode?.type === "trigger") {
        toast.error("Cannot connect to trigger node input");
        return;
      }

      if (TERMINAL_NODE_TYPES.includes(sourceNode.type )) {
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

  const addNode = (type) => {
    // Allow multiple terminal nodes (email, github-issue, slack) but restrict others to one instance
    if (!TERMINAL_NODE_TYPES.includes(type) && nodes.some((node) => node.type === type)) {
      toast.error(`A ${type} node already exists in this workflow`);
      return;
    }

    const triggerExists = nodes.some((node) => node.type === "trigger");
    if (!triggerExists) {
      addTriggerNode();
      toast.info("A trigger node h added automatically");
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

    const newNode= {
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

  const checkNodeCompatibility = (nodeType, dataSource) => {
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
        "web-hygiene",
        "nuclei",
        "js-recon",
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
          "web-hygiene",
          "nuclei",
          "js-recon",
          "owasp-zap",
          "owasp-baseline",
          "owasp-dependency-check",
          // SAST tools (for code analysis)
          "flow-chart",
          "owasp-vulnerabilities",
          "code-scan",
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
          "code-scan",
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
  const detectExecutionMode = useCallback(() => {
    if (nodes.length <= 2) return "sequential"; // Just trigger + 1 node

    // Build dependency graph to detect parallel opportunities
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map();
    const adjList = new Map();
    
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
    const queue = [];
    const visitedCount = new Set();
    
    // Find all nodes with no incoming edges
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });
    
    while (queue.length > 0) {
      const currentLevelSize = queue.length;
      
      // If more than one node can run at the same level (excluding trigger), it's parallel
      const currentLevelNodes = [];
      for (let i = 0; i < currentLevelSize; i++) {
        const nodeId = queue.shift();
        const node = nodeMap.get(nodeId);
        if (node && node.type !== "trigger") {
          currentLevelNodes.push(node );
        }
        visitedCount.add(nodeId);
        
        // Process neighbors
        adjList.get(nodeId)?.forEach((neighborId) => {
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

  const validateWorkflow = () => {
    if (nodes.length === 0) {
      return { valid: false, message: "Workflow must have at least one node" };
    }

    const triggerNode = nodes.find((node) => node.type === "trigger");
    if (!triggerNode) {
      return { valid: false, message: "Workflow must have a trigger node" };
    }

    const connectedNodeIds = new Set();
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
      TERMINAL_NODE_TYPES.includes(node.type )
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
      (node) => !TERMINAL_NODE_TYPES.includes(node.type )
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
      TERMINAL_NODE_TYPES.includes(node.type )
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
      
      const updatedWorkflow= {
        ...workflow,
        updatedAt: new Date().toISOString(),
        nodes: [...nodes],
        edges: [...edges],
        executionMode: detectedExecutionMode,
      };

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

      await updateWorkflow(updatedWorkflow, user?.username);
      setWorkflow(updatedWorkflow);

      toast.success("Workflow saved", {
        description: "Your workflow h saved successfully.",
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

  const getAvailableNodes = () => {
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
        { type: "web-hygiene", label: "Web Hygiene" },
        { type: "nuclei", label: "Nuclei" },
        { type: "js-recon", label: "JS Recon" },
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
          { type: "web-hygiene", label: "Web Hygiene (DAST)" },
          { type: "nuclei", label: "Nuclei (DAST)" },
          { type: "js-recon", label: "JS Recon (DAST)" },
          { type: "owasp-zap", label: "OWASP ZAP" },
          { type: "owasp-baseline", label: "OWASP Baseline" },
          { type: "owasp-dependency-check", label: "OWASP Dependency" },
          // SAST tools
          { type: "owasp-vulnerabilities", label: "OWASP Comprehensive (SAST)" },
          { type: "code-scan", label: "Code Scan (SAST)" },
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
          { type: "code-scan", label: "Code Scan (SAST)" },
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

  const openNodeConfig = (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const t = node.type ;
    if (TERMINAL_NODE_TYPES.includes(t)) {
      setConfigNodeId(nodeId);
      setConfigNodeType(t);
      setConfigNodeData(node.data?.config || {});
      setShowConfigDialog(true);
    } else if (OWASP_NODE_TYPES.includes(t)) {
      setConfigNodeId(nodeId);
      setConfigNodeType(t);
      setConfigNodeData(node.data || {});
      setShowOWASPConfigDialog(true);
    } else if (SCAN_TOOL_NODE_TYPES.includes(t)) {
      setConfigNodeId(nodeId);
      setConfigNodeType(t);
      setConfigNodeData(node.data || {});
      setShowScanConfigDialog(true);
    } else {
      toast.info("This node type doesn't have configuration options");
    }
  };

  const handleNodeDoubleClick= useCallback((event, node) => {
      event.preventDefault();
      const workflowNode = node ;
      const t = workflowNode.type ;
      if (
        TERMINAL_NODE_TYPES.includes(t) ||
        OWASP_NODE_TYPES.includes(t) ||
        SCAN_TOOL_NODE_TYPES.includes(t)
      ) {
        openNodeConfig(workflowNode.id);
      }
    },
    [openNodeConfig]
  );

  const saveNodeConfig = (configData) => {
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
              data: configData,
            };
          } else {
            // OWASP + scan-tool nodes: backend reads options directly from node.data.*
            return {
              ...node,
              data: configData,
            };
          }
        }
        return node;
      })
    );
    toast.success("Configuration saved");
  };

  return (
    <>

      <div ref={reactFlowWrapper} className="relative h-screen w-screen">
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
            className={`${theme === "dark" ? `bg-[#09090b]` : `bg-white`}`}
            gap={16}
            size={1.4}
            color={theme === "dark" ? "#52525b" : "#d4d4d8"}
          />
          <Controls className="[&_button]:bg-[#131315] [&_button]:border-[#27272a] [&_button]:text-[#bccbb9] [&_button:hover]:bg-[#201f22] [&_button:hover]:text-[#4be277] rounded-lg overflow-hidden border border-[#27272a]" />

          <Panel
            position="top-left"
            className="ml-4 mt-4 flex items-center gap-3"
            style={{ fontFamily: "'Geist', sans-serif" }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              className="gap-1.5 rounded-lg border-[#27272a] bg-[#131315] text-[#e5e1e4] hover:bg-[#201f22] hover:text-[#4be277] hover:border-[#3f3f46] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <h2 className="text-lg font-bold tracking-tight text-[#e5e1e4]">
              {workflow?.name || "Workflow Builder"}
            </h2>

            <div className="px-3 py-1.5 bg-[#131315]/90 backdrop-blur-sm border border-[#27272a] rounded-lg">
              <ExecutionFlowIndicator nodes={nodes} edges={edges} />
            </div>
          </Panel>

          <Panel
            position="top-right"
            className="mr-4 mt-4 flex items-center gap-2"
            style={{ fontFamily: "'Geist', sans-serif" }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={deleteSelectedNodes}
                    className="rounded-lg border-[#27272a] bg-[#131315] text-[#bccbb9] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Delete selected nodes
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
                    className="rounded-lg border-[#27272a] bg-[#131315] text-[#bccbb9] hover:bg-[#201f22] hover:text-[#e5e1e4] hover:border-[#3f3f46] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Clear all nodes except trigger
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-1.5 rounded-lg border-[#27272a] bg-[#131315] text-[#e5e1e4] hover:bg-[#201f22] hover:text-[#4be277] hover:border-[#4be277]/40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Node
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60 bg-[#131315] border-[#27272a] text-[#e5e1e4]">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-[#bccbb9]/60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Available Nodes
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#27272a]" />
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
                        className={`cursor-pointer focus:bg-[#4be277]/10 focus:text-[#4be277] ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm">{node.label}</span>
                          {node.canAddMultiple && nodeCount > 0 && (
                            <span className="text-[11px] text-[#bccbb9]/60 ml-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {nodeCount} added
                            </span>
                          )}
                          {node.canAddMultiple && nodeCount === 0 && (
                            <Plus className="h-3 w-3 text-[#4be277] ml-2" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  {getAvailableNodes().length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-[#bccbb9]/60">
                      Configure a trigger first
                    </div>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={saveWorkflow}
              className="gap-1.5 rounded-lg bg-[#4be277] text-[#003915] font-bold hover:bg-[#43cc6c] hover:text-[#003915] hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
              disabled={isSaving || isLoading}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Saving…" : "Save Workflow"}
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

        {/* Live execution log console */}
        {showLogConsole && progress && progress.status !== "idle" && (
          <LiveLogConsole
            progress={progress}
            onClose={() => setShowLogConsole(false)}
            onShowDetails={() =>
              progress?.reportId
                ? navigate(`/run/${progress.reportId}`)
                : setShowExecutionPanel(true)
            }
          />
        )}

        {/* Floating AI prompt (Stitch-style) */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex justify-center px-4"
          style={{ fontFamily: "'Geist', sans-serif" }}
        >
          {isPromptPanelCollapsed ? (
            <button
              type="button"
              onClick={() => setIsPromptPanelCollapsed(false)}
              className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-[#27272a] bg-[#131315]/90 backdrop-blur-xl px-4 py-2.5 shadow-2xl shadow-black/50 text-sm text-[#bccbb9] hover:text-[#4be277] hover:border-[#4be277]/40 transition-colors"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4be277]/10 border border-[#4be277]/25 text-[#4be277]">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              Ask the AI agent…
            </button>
          ) : (
            <form
              onSubmit={handlePromptSubmit}
              className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-[#27272a] bg-[#131315]/90 backdrop-blur-xl shadow-2xl shadow-black/60 p-2.5"
            >
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-[#e5e1e4]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#4be277]/10 border border-[#4be277]/25 text-[#4be277]">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  AI Security Workflow Agent
                  <span
                    className="text-[9px] uppercase tracking-[0.18em] text-[#bccbb9]/50"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    beta
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPromptPanelCollapsed(true)}
                  className="p-1 rounded-md text-[#bccbb9]/70 hover:bg-[#201f22] hover:text-[#4be277] transition-colors"
                  aria-label="Minimize"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  id="workflow-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handlePromptSubmit(e  .FormEvent);
                    }
                  }}
                  placeholder="Describe a scan in plain English — e.g. 'scan http://testphp.vulnweb.com for OWASP and email me'"
                  className="flex-1 resize-none min-h-[44px] max-h-40 text-sm rounded-xl bg-[#0f0f10] border border-[#3f3f46]/50 text-[#e5e1e4] placeholder:text-[#bccbb9]/40 focus-visible:ring-0 focus-visible:border-[#4be277] focus:border-[#4be277] transition-colors"
                  disabled={isPromptLoading}
                />
                <Button
                  type="submit"
                  disabled={isPromptLoading || !prompt.trim()}
                  size="icon"
                  aria-label="Generate & execute workflow"
                  className="h-11 w-11 shrink-0 rounded-xl bg-[#4be277] text-[#003915] font-bold hover:bg-[#43cc6c] hover:text-[#003915] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
                >
                  {isPromptLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between px-2 pt-2">
                <span
                  className="text-[10px] text-[#bccbb9]/45"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  ⌘↵ to generate &amp; execute
                </span>
                {promptError && (
                  <span className="text-red-400 text-[11px]">{promptError}</span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Execution Progress & Logs - Removed from here */}
      </div>

      {/* Execution Panel - Side Sheet */}
      <Sheet open={showExecutionPanel} onOpenChange={setShowExecutionPanel}>
        <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
          <SheetHeader>
            Workflow Execution Progress
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

      <ScanNodeConfigDialog
        open={showScanConfigDialog}
        onOpenChange={setShowScanConfigDialog}
        nodeType={configNodeType || "nmap"}
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
