import type { Node, Edge } from "reactflow";

export type DataSource = "Domain" | "GitHub";
export type Frequency = "2min" | "2hr" | "4hr" | "6hr" | "12hr" | "1 day";
export type ExecutionMode = "sequential" | "parallel";

export type NodeType =
  | "trigger"
  | "gobuster"
  | "nikto"
  | "nmap"
  | "sqlmap"
  | "wpscan"
  | "owasp-vulnerabilities"
  | "owasp-zap"
  | "owasp-baseline"
  | "owasp-dependency-check"
  | "flow-chart"
  | "email"
  | "github-issue"
  | "slack";

export interface WorkflowNode extends Node {
  type: NodeType;
  data: any;
}

export type WorkflowEdge = Edge;

export interface TriggerData {
  dataSource: DataSource;
  url: string;
  frequency: Frequency;
}

export interface Workflow {
  id: string;
  _id?: string; // MongoDB ObjectId from backend
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  executionMode?: ExecutionMode;
}
