import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  Search,
  Network,
  Database,
  FileCode,
  Mail,
  Github,
  MessageCircle,
  Workflow,
  ShieldQuestion,
  Shield,
} from "lucide-react";
import type { NodeType } from "@/types/workflow";

// We extend NodeProps to ensure compatibility with ReactFlow
const WorkflowNode = memo(({ type, data, isConnectable }: NodeProps) => {
  // Cast the type to our NodeType to use in our switch statement
  const nodeType = type as NodeType;

  // Determine if this node is a terminal node (email, GitHub issue, or Slack)
  const isTerminalNode = ["email", "github-issue", "slack"].includes(nodeType);

  const getNodeConfig = () => {
    switch (nodeType) {
      case "gobuster":
        return {
          label: "Gobuster",
          icon: <Search className="w-5 h-5" />,
          color: "bg-pink-500",
        };
      case "nikto":
        return {
          label: "Nikto",
          icon: <Shield className="w-5 h-5" />,
          color: "bg-purple-500",
        };
      case "nmap":
        return {
          label: "Nmap",
          icon: <Network className="w-5 h-5" />,
          color: "bg-blue-500",
        };
      case "sqlmap":
        return {
          label: "SQLMap",
          icon: <Database className="w-5 h-5" />,
          color: "bg-red-500",
        };
      case "wpscan":
        return {
          label: "WPScan",
          icon: <FileCode className="w-5 h-5" />,
          color: "bg-green-500",
        };
      case "owasp-vulnerabilities":
        return {
          label: "OWASP Comprehensive",
          icon: <ShieldQuestion className="w-5 h-5" />,
          color: "bg-purple-500",
        };
      case "owasp-zap":
        return {
          label: "OWASP ZAP",
          icon: <ShieldQuestion className="w-5 h-5" />,
          color: "bg-indigo-500",
        };
      case "owasp-baseline":
        return {
          label: "OWASP Baseline",
          icon: <ShieldQuestion className="w-5 h-5" />,
          color: "bg-violet-500",
        };
      case "owasp-dependency-check":
        return {
          label: "OWASP Dependency",
          icon: <ShieldQuestion className="w-5 h-5" />,
          color: "bg-fuchsia-500",
        };
      case "flow-chart":
        return {
          label: "Flow Chart",
          icon: <Workflow className="w-5 h-5" />,
          color: "bg-cyan-500",
        };
      case "email":
        return {
          label: "Email",
          icon: <Mail className="w-5 h-5" />,
          color: "bg-blue-500",
        };
      case "github-issue":
        return {
          label: "GitHub Issue",
          icon: <Github className="w-5 h-5" />,
          color: "bg-cyan-500",
        };
      case "slack":
        return {
          label: "Slack",
          icon: <MessageCircle className="w-5 h-5" />,
          color: "bg-green-500",
        };
      default:
        return {
          label: "Unknown Node",
          icon: <Search className="w-5 h-5" />,
          color: "bg-gray-400",
        };
    }
  };

  const config = getNodeConfig();

  return (
    <div className="workflow-node min-w-[180px]">
      <div className={`workflow-node-icon ${config.color}`}>{config.icon}</div>
      <div>{config.label}</div>

      {data?.config && (
        <div className="text-xs text-gray-500 mt-1 max-w-full truncate">
          {nodeType === "email" && data.config.email
            ? `To: ${data.config.email}`
            : ""}
          {nodeType === "github-issue" && (data.config.repository || data.config.repo)
            ? `Repo: ${data.config.repository || data.config.repo}`
            : ""}
          {nodeType === "slack" && data.config.channel
            ? `Channel: ${data.config.channel}`
            : ""}
        </div>
      )}

      {/* Input handle - always present */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className=""
        isConnectable={isConnectable}
      />

      {/* Output handle - only present for non-terminal nodes */}
      {!isTerminalNode && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="workflow-node-connection-point workflow-node-output"
          isConnectable={isConnectable}
        />
      )}
    </div>
  );
});

export default WorkflowNode;
