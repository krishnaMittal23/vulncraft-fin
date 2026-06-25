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
  ShieldCheck,
  Radar,
  Braces,
  ScanLine,
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
      case "web-hygiene":
        return {
          label: "Web Hygiene",
          icon: <ShieldCheck className="w-5 h-5" />,
          color: "bg-teal-500",
        };
      case "nuclei":
        return {
          label: "Nuclei",
          icon: <Radar className="w-5 h-5" />,
          color: "bg-amber-500",
        };
      case "js-recon":
        return {
          label: "JS Recon",
          icon: <Braces className="w-5 h-5" />,
          color: "bg-sky-500",
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
      case "code-scan":
        return {
          label: "Code Scan",
          icon: <ScanLine className="w-5 h-5" />,
          color: "bg-rose-500",
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

      {/* Compact summary of saved scan-tool / OWASP options */}
      {data && !data.config && (
        <div className="mt-1 max-w-full truncate text-[11px] text-[#bccbb9]/70" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {nodeType === "nmap" && data.nmap_arguments ? data.nmap_arguments : ""}
          {nodeType === "nuclei" && data.severity ? data.severity : ""}
          {nodeType === "sqlmap" && data.sqlmap_level ? `level ${data.sqlmap_level} · risk ${data.sqlmap_risk}` : ""}
          {nodeType === "gobuster" && data.gobuster_extensions ? `-x ${data.gobuster_extensions}` : ""}
          {nodeType === "wpscan" && data.wpscan_enumerate ? `enum ${data.wpscan_enumerate}` : ""}
          {(nodeType === "owasp-zap" || nodeType === "owasp-vulnerabilities") && typeof data.active_scan === "boolean"
            ? (data.active_scan ? "active scan" : "passive only")
            : ""}
        </div>
      )}

      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#bccbb9]/40" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        double-click to configure
      </div>

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
