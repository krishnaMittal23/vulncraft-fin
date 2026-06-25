import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeType } from "@/types/workflow";

interface OWASPNodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeType: NodeType;
  initialData?: any;
  onSave: (data: any) => void;
}

const OWASPNodeConfigDialog = ({
  open,
  onOpenChange,
  nodeType,
  initialData,
  onSave,
}: OWASPNodeConfigDialogProps) => {
  // OWASP ZAP config
  const [activeScan, setActiveScan] = useState(
    initialData?.active_scan !== false ? "true" : "false"
  );
  const [spider, setSpider] = useState(
    initialData?.spider !== false ? "true" : "false"
  );
  const [timeout, setTimeout] = useState(
    initialData?.timeout?.toString() || "300"
  );
  const [owaspTop10Check, setOwaspTop10Check] = useState(
    initialData?.owasp_top10_check !== false ? "true" : "false"
  );
  const [securityHeadersCheck, setSecurityHeadersCheck] = useState(
    initialData?.security_headers_check !== false ? "true" : "false"
  );
  const [sslTlsCheck, setSslTlsCheck] = useState(
    initialData?.ssl_tls_check !== false ? "true" : "false"
  );

  // Dependency Check config
  const [projectPath, setProjectPath] = useState(
    initialData?.project_path || "/app"
  );

  const handleSave = () => {
    let configData = {};

    if (nodeType === "owasp-zap" || nodeType === "owasp-vulnerabilities") {
      configData = {
        active_scan: activeScan === "true",
        spider: spider === "true",
        timeout: parseInt(timeout),
        owasp_top10_check: owaspTop10Check === "true",
        security_headers_check: securityHeadersCheck === "true",
        ssl_tls_check: sslTlsCheck === "true",
      };
    } else if (nodeType === "owasp-baseline") {
      configData = {
        active_scan: false, // Baseline is always passive
        spider: true,
        timeout: Math.min(parseInt(timeout), 120), // Max 2 minutes for baseline
      };
    } else if (nodeType === "owasp-dependency-check") {
      configData = {
        project_path: projectPath,
      };
    }

    onSave(configData);
    onOpenChange(false);
  };

  const getNodeDescription = () => {
    switch (nodeType) {
      case "owasp-zap":
        return "Configure OWASP ZAP comprehensive security scan settings.";
      case "owasp-vulnerabilities":
        return "Configure comprehensive OWASP security assessment options.";
      case "owasp-baseline":
        return "Configure OWASP ZAP baseline scan (passive only, fast scan).";
      case "owasp-dependency-check":
        return "Configure OWASP Dependency Check for vulnerable dependencies.";
      default:
        return "Configure OWASP security scan settings.";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure {nodeType.replace(/-/g, " ")} Node
          </DialogTitle>
          <DialogDescription>{getNodeDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ZAP and Comprehensive OWASP scan options */}
          {(nodeType === "owasp-zap" || nodeType === "owasp-vulnerabilities") && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="activeScan">Active Scanning</Label>
                  <Select value={activeScan} onValueChange={setActiveScan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Enabled (sends attack payloads)</SelectItem>
                      <SelectItem value="false">Disabled (passive only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spider">Spider Crawling</Label>
                  <Select value={spider} onValueChange={setSpider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Enabled (crawl website)</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owaspTop10">OWASP Top 10 Analysis</Label>
                  <Select value={owaspTop10Check} onValueChange={setOwaspTop10Check}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Enabled</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="securityHeaders">Security Headers Check</Label>
                  <Select value={securityHeadersCheck} onValueChange={setSecurityHeadersCheck}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Enabled</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sslTls">SSL/TLS Analysis</Label>
                  <Select value={sslTlsCheck} onValueChange={setSslTlsCheck}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Enabled</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Scan Timeout (seconds)</Label>
                  <Select value={timeout} onValueChange={setTimeout}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="120">2 minutes</SelectItem>
                      <SelectItem value="180">3 minutes</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="600">10 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Baseline scan options */}
          {nodeType === "owasp-baseline" && (
            <>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">
                  Baseline Scan Information
                </h4>
                <p className="text-sm text-blue-700">
                  Baseline scans are passive-only, fast security scans that don't
                  send attack payloads. They're ideal for quick security checks
                  and continuous monitoring.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Scan Timeout (max 2 minutes)</Label>
                <Select value={timeout} onValueChange={setTimeout}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="120">2 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Dependency check options */}
          {nodeType === "owasp-dependency-check" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="projectPath">Project Path</Label>
                <Input
                  id="projectPath"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/app"
                />
                <p className="text-xs text-muted-foreground">
                  Path to the project directory containing package files
                  (package.json, requirements.txt, etc.)
                </p>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-900 mb-2">
                  Dependency Check Information
                </h4>
                <p className="text-sm text-orange-700">
                  This scan analyzes project dependencies for known
                  vulnerabilities. Ensure the project path contains dependency
                  files like package.json, requirements.txt, or similar.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OWASPNodeConfigDialog;