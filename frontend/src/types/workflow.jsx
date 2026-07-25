// Types are documented via JSDoc comments below


/**
 * @typedef {'Domain' | 'GitHub'} DataSource
 */
export const DataSources = {
  DOMAIN: "Domain",
  GITHUB: "GitHub",
};

/**
 * @typedef {'2min' | '2hr' | '4hr' | '6hr' | '12hr' | '1 day'} Frequency
 */
export const Frequencies = {
  EVERY_2_MIN: "2min",
  EVERY_2_HR: "2hr",
  EVERY_4_HR: "4hr",
  EVERY_6_HR: "6hr",
  EVERY_12_HR: "12hr",
  EVERY_DAY: "1 day",
};

/**
 * @typedef {'sequential' | 'parallel'} ExecutionMode
 */
export const ExecutionModes = {
  SEQUENTIAL: "sequential",
  PARALLEL: "parallel",
};

/**
 * @typedef {'trigger' | 'gobuster' | 'nikto' | 'nmap' | 'sqlmap' | 'wpscan' | 'web-hygiene' | 'nuclei' | 'js-recon' | 'owasp-vulnerabilities' | 'owasp-zap' | 'owasp-baseline' | 'owasp-dependency-check' | 'code-scan' | 'flow-chart' | 'email' | 'github-issue' | 'slack'} NodeType
 */
export const NodeTypes = {
  TRIGGER: "trigger",
  GOBUSTER: "gobuster",
  NIKTO: "nikto",
  NMAP: "nmap",
  SQLMAP: "sqlmap",
  WPSCAN: "wpscan",
  WEB_HYGIENE: "web-hygiene",
  NUCLEI: "nuclei",
  JS_RECON: "js-recon",
  OWASP_VULNERABILITIES: "owasp-vulnerabilities",
  OWASP_ZAP: "owasp-zap",
  OWASP_BASELINE: "owasp-baseline",
  OWASP_DEPENDENCY_CHECK: "owasp-dependency-check",
  CODE_SCAN: "code-scan",
  FLOW_CHART: "flow-chart",
  EMAIL: "email",
  GITHUB_ISSUE: "github-issue",
  SLACK: "slack",
};

/**
 * @typedef {Object} WorkflowNode
 * @extends {Node}
 * @property {NodeType} type
 * @property {any} data
 */

/**
 * @typedef {Edge} WorkflowEdge
 */

/**
 * @typedef {Object} TriggerData
 * @property {DataSource} dataSource
 * @property {string} url
 * @property {Frequency} frequency
 */

/**
 * @typedef {Object} Workflow
 * @property {string} id
 * @property {string} [_id] - MongoDB ObjectId from backend
 * @property {string} name
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {WorkflowNode} nodes
 * @property {WorkflowEdge} edges
 * @property {ExecutionMode} [executionMode]
 */

export {};