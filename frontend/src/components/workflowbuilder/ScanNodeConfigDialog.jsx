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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NMAP_PROFILES = {
  fast: "-F",
  service: "-sV -F",
  scripts: "-sV -sC",
  intense: "-T4 -A",
};

const NUCLEI_SEVERITIES = ["low", "medium", "high", "critical"];

const TITLES = {
  gobuster: "Gobuster",
  nmap: "Nmap",
  sqlmap: "SQLMap",
  wpscan: "WPScan",
  nikto: "Nikto",
  "web-hygiene": "Web Hygiene",
  nuclei: "Nuclei",
  "js-recon": "JS Recon",
};

const ScanNodeConfigDialog = ({
  open, onOpenChange, nodeType, initialData, onSave,
}) => {
  // nmap
  const [nmapProfile, setNmapProfile] = useState(initialData?.nmap_profile || "service");
  const [nmapPorts, setNmapPorts] = useState(initialData?.nmap_ports || "");
  // gobuster
  const [gobusterExtensions, setGobusterExtensions] = useState(initialData?.gobuster_extensions || "");
  // sqlmap
  const [sqlmapLevel, setSqlmapLevel] = useState(initialData?.sqlmap_level?.toString() || "1");
  const [sqlmapRisk, setSqlmapRisk] = useState(initialData?.sqlmap_risk?.toString() || "1");
  const [testUrl, setTestUrl] = useState(initialData?.testUrl || "");
  // wpscan
  const [wpscanEnumerate, setWpscanEnumerate] = useState(initialData?.wpscan_enumerate || "vp,vt,u");
  // nikto
  const [niktoTuning, setNiktoTuning] = useState(initialData?.nikto_tuning || "");
  // web-hygiene
  const [checkExposedPaths, setCheckExposedPaths] = useState(
    initialData?.check_exposed_paths !== false
  );
  // nuclei
  const [severities, setSeverities] = useState(
    initialData?.severity
      ? String(initialData.severity).split(",").map((s) => s.trim()).filter(Boolean)
      : []
  );
  const [nucleiTimeout, setNucleiTimeout] = useState(initialData?.timeout?.toString() || "240");

  const toggleSeverity = (sev) => {
    setSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  };

  const handleSave = () => {
    let config = {};
    switch (nodeType) {
      case "nmap": {
        const base = NMAP_PROFILES[nmapProfile] || NMAP_PROFILES.service;
        const args = nmapPorts.trim() ? `${base} -p ${nmapPorts.trim()}` : base;
        config = { nmap_profile: nmapProfile, nmap_ports: nmapPorts.trim(), nmap_arguments: args };
        break;
      }
      case "gobuster":
        config = { ...(gobusterExtensions.trim() ? { gobuster_extensions: gobusterExtensions.trim() } : {}) };
        break;
      case "sqlmap":
        config = {
          sqlmap_level: parseInt(sqlmapLevel),
          sqlmap_risk: parseInt(sqlmapRisk),
          ...(testUrl.trim() ? { testUrl: testUrl.trim() } : {}),
        };
        break;
      case "wpscan":
        config = { wpscan_enumerate: wpscanEnumerate };
        break;
      case "nikto":
        config = { ...(niktoTuning.trim() ? { nikto_tuning: niktoTuning.trim() } : {}) };
        break;
      case "web-hygiene":
        config = { check_exposed_paths: checkExposedPaths };
        break;
      case "nuclei":
        config = {
          severity: (severities.length ? severities : NUCLEI_SEVERITIES).join(","),
          timeout: parseInt(nucleiTimeout),
        };
        break;
      default:
        break;
    }
    onSave(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure {TITLES[nodeType] || nodeType} Node
          </DialogTitle>
          <DialogDescription>
            Tune how this scanner runs. Sensible defaults are pre-selected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {nodeType === "nmap" && (
            <>
              <div className="space-y-2">
                <Label>Scan profile</Label>
                <Select value={nmapProfile} onValueChange={setNmapProfile}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Fast — top 100 ports (-F)</SelectItem>
                    <SelectItem value="service">Service detection (-sV -F)</SelectItem>
                    <SelectItem value="scripts">Service + default scripts (-sV -sC)</SelectItem>
                    <SelectItem value="intense">Intense (-T4 -A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmapPorts">Ports (optional)</Label>
                <Input
                  id="nmapPorts"
                  value={nmapPorts}
                  onChange={(e) => setNmapPorts(e.target.value)}
                  placeholder="e.g. 80,443,8080 or 1-1000"
                />
                <p className="text-xs text-muted-foreground">Digits, commas, dashes only.</p>
              </div>
            </>
          )}

          {nodeType === "gobuster" && (
            <div className="space-y-2">
              <Label htmlFor="gobExt">File extensions (optional)</Label>
              <Input
                id="gobExt"
                value={gobusterExtensions}
                onChange={(e) => setGobusterExtensions(e.target.value)}
                placeholder="e.g. php,html,js,txt,bak"
              />
              <p className="text-xs text-muted-foreground">
                Also probe each path with these extensions (gobuster -x). Leave blank for directories only.
              </p>
            </div>
          )}

          {nodeType === "sqlmap" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Level (1–5)</Label>
                  <Select value={sqlmapLevel} onValueChange={setSqlmapLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Risk (1–3)</Label>
                  <Select value={sqlmapRisk} onValueChange={setSqlmapRisk}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="testUrl">Specific URL to test (optional)</Label>
                <Input
                  id="testUrl"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://site.com/page.php?id=1"
                />
                <p className="text-xs text-muted-foreground">Higher level/risk = more thorough but slower.</p>
              </div>
            </>
          )}

          {nodeType === "wpscan" && (
            <div className="space-y-2">
              <Label>Enumerate</Label>
              <Select value={wpscanEnumerate} onValueChange={setWpscanEnumerate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vp,vt,u">Vulnerable plugins, themes &amp; users</SelectItem>
                  <SelectItem value="vp">Vulnerable plugins only</SelectItem>
                  <SelectItem value="ap,at,u">All plugins, themes &amp; users (slow)</SelectItem>
                  <SelectItem value="u">Users only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {nodeType === "nikto" && (
            <div className="space-y-2">
              <Label htmlFor="niktoTuning">Tuning (optional)</Label>
              <Input
                id="niktoTuning"
                value={niktoTuning}
                onChange={(e) => setNiktoTuning(e.target.value)}
                placeholder="e.g. 1234567890abc"
              />
              <p className="text-xs text-muted-foreground">
                Nikto -Tuning codes (1=interesting files, 2=misconfig, 9=SQLi, etc.). Leave blank for all.
              </p>
            </div>
          )}

          {nodeType === "web-hygiene" && (
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="checkExposed"
                checked={checkExposedPaths}
                onCheckedChange={(c) => setCheckExposedPaths(c)}
              />
              <div className="grid gap-1 leading-none">
                <Label htmlFor="checkExposed" className="text-sm font-medium">
                  Probe for exposed sensitive files
                </Label>
                <p className="text-xs text-muted-foreground">
                  Checks for publicly accessible /.git, /.env, source maps, backups, etc.
                  Always-on checks (headers, TLS, cookies, CORS) run regardless.
                </p>
              </div>
            </div>
          )}

          {nodeType === "js-recon" && (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              JS Recon crawls the target&apos;s JavaScript for endpoints, secrets and
              other interesting references. It has no options to configure — just
              connect it into the workflow.
            </div>
          )}

          {nodeType === "nuclei" && (
            <>
              <div className="space-y-2">
                <Label>Severities to report</Label>
                <div className="flex flex-wrap gap-3">
                  {NUCLEI_SEVERITIES.map((sev) => (
                    <label key={sev} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                      <Checkbox
                        checked={severities.includes(sev)}
                        onCheckedChange={() => toggleSeverity(sev)}
                      />
                      {sev}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Timeout</Label>
                <Select value={nucleiTimeout} onValueChange={setNucleiTimeout}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="120">2 minutes</SelectItem>
                    <SelectItem value="240">4 minutes</SelectItem>
                    <SelectItem value="360">6 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScanNodeConfigDialog;
