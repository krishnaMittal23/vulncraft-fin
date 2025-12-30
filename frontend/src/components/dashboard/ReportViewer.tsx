import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";


interface Report {
  _id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  targetUrl: string;
  status: "running" | "completed" | "failed" | "partial";
  startTime: string;
  endTime?: string;
  duration?: number;
  results?: any;
  findings: {
    total: number;
  };
  nodeResults: Array<{
    nodeId: string;
    nodeType: string;
    status: string;
    output: any;
    detailedAnalysis?: any; // LLM-generated detailed analysis
    duration: number;
  }>;
  executionErrors: Array<{
    nodeId?: string;
    nodeType?: string;
    message: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function ReportViewer({ workflowId }: { workflowId?: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    fetchReports();
  }, [workflowId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = workflowId
        ? `${API_URL}/api/reports/workflow/${workflowId}`
        : `${API_URL}/api/reports`;

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }

      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      running: "default",
      completed: "default",
      failed: "destructive",
      partial: "secondary",
    };

    return (
      <Badge variant={variants[status] || "default"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-zinc-900/90 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Error Loading Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-300 mb-4">{error}</p>
          <Button 
            onClick={fetchReports} 
            className="bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 text-white"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="bg-zinc-900/90 backdrop-blur-xl border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-white">No Reports Found</CardTitle>
          <CardDescription className="text-gray-300">
            Execute a workflow to generate security scan reports
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Report List */}
      {!selectedReport && (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card
              key={report._id}
              className="cursor-pointer hover:shadow-lg hover:shadow-white/10 transition-all duration-300 ease-in-out bg-zinc-900/90 backdrop-blur-xl border-zinc-700/50"
              onClick={() => setSelectedReport(report)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <CardTitle className="text-2xl text-white font-bold">
                      {report.workflowName || "Unnamed Workflow"}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 text-gray-300 text-sm">
                      <span>{report.targetUrl}</span>
                      <span className="text-gray-500">•</span>
                      <span>
                        {new Date(report.startTime).toLocaleString()}
                      </span>
                      {report.duration && (
                        <>
                          <span className="text-gray-500">•</span>
                          <span>
                            {formatDuration(report.duration)}
                          </span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
              </CardHeader>
              <CardContent>
                  <div className="flex items-center gap-3">
                  <div className="text-4xl font-bold text-white">{report.findings.total}</div>
                  <div className="text-base text-gray-300 font-semibold">Total Findings</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report Details */}
      {selectedReport && (
        <div className="space-y-4">
          <Button 
            variant="outline" 
            onClick={() => setSelectedReport(null)}
            className="border-zinc-700/50 text-white hover:bg-zinc-800/50 hover:text-gray-200"
          >
            ← Back to Reports
          </Button>

          <Card className="bg-zinc-900/90 backdrop-blur-xl border-zinc-700/50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl text-white font-bold">{selectedReport.workflowName}</CardTitle>
                  <CardDescription className="space-y-1 text-gray-300 text-base">
                    <div><span className="font-semibold">Target:</span> {selectedReport.targetUrl}</div>
                    <div><span className="font-semibold">Started:</span> {new Date(selectedReport.startTime).toLocaleString()}</div>
                    {selectedReport.endTime && (
                      <div><span className="font-semibold">Ended:</span> {new Date(selectedReport.endTime).toLocaleString()}</div>
                    )}
                    {selectedReport.duration && (
                      <div><span className="font-semibold">Duration:</span> {formatDuration(selectedReport.duration)}</div>
                    )}
                  </CardDescription>
                </div>
                {getStatusBadge(selectedReport.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Findings Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-black/40 border-zinc-700/50 transition-transform duration-300 ease-in-out">
                  <CardContent className="pt-6">
                    <div className="text-4xl font-bold text-white">{selectedReport.findings.total}</div>
                    <div className="text-base text-gray-300 font-semibold mt-2">Total</div>
                  </CardContent>
                </Card>
              </div>

              {/* Node Results */}
              <div>
                <h3 className="text-xl font-bold mb-4 text-white">Execution Details</h3>
                <div className="space-y-6">
                  {selectedReport.nodeResults.map((node, index) => (
                    <Card key={index} className="bg-black/40 border-emerald-500/20 transition-transform duration-300">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(node.status)}
                            <div>
                              <div className="font-semibold capitalize text-white text-lg">{node.nodeType}</div>
                              <div className="text-base text-gray-300 mt-1">
                                {formatDuration(node.duration)}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-sm px-3 py-1">{node.status}</Badge>
                        </div>

                        {/* Detailed Analysis Section */}
                        {node.detailedAnalysis && (
                          <div className="mt-5 space-y-4 border-t border-emerald-500/20 pt-5">
                            {/* Summary */}
                            {node.detailedAnalysis.summary && (
                              <div className="bg-zinc-800/50 p-4 rounded-lg border border-emerald-500/20">
                                <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                                  📋 Summary
                                </h4>
                                <p className="text-base text-gray-200">
                                  {node.detailedAnalysis.summary}
                                </p>
                              </div>
                            )}

                            {/* Nmap - Open Ports */}
                            {node.nodeType === 'nmap' && (
                              <div>
                                {node.output?.nmap_scan?.open_ports && node.output.nmap_scan.open_ports.length > 0 ? (
                                  <>
                                    <h4 className="text-base font-semibold mb-3 text-white flex items-center gap-2">🔓 Open Ports</h4>
                                    <div className="space-y-3">
                                      {node.output.nmap_scan.open_ports.map((port: any, idx: number) => (
                                        <div key={idx} className="bg-zinc-800/50 p-4 rounded-lg border border-emerald-500/20">
                                          <div className="flex items-center gap-4 mb-3">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-xl text-white">{port.port}</span>
                                              <span className="text-sm text-gray-400 uppercase font-medium">{port.protocol}</span>
                                            </div>
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-sm px-3 py-1">
                                              {port.state}
                                            </Badge>
                                          </div>
                                          <p className="text-base text-gray-300">
                                            <span className="font-semibold text-white">Service:</span> {port.service}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : null}
                                
                                {/* Show total findings if available */}
                                {node.output?.total_findings !== undefined && (
                                  <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg border border-emerald-500/20">
                                    <span className="text-base font-semibold text-white">
                                      Total Findings: <span className="text-emerald-400">{node.output.total_findings}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* SQLMap - Vulnerabilities */}
                            {node.nodeType === 'sqlmap' && (
                              <div className="space-y-4">
                                {/* Raw SQLMap Scan Results */}
                                {node.output?.sqlmap_scan && (
                                  <div>
                                    <h4 className="text-base font-semibold mb-4 text-white flex items-center gap-3">
                                      <span className="text-xl">📊</span>
                                      SQLMap Scan Results
                                    </h4>
                                    
                                    {/* Vulnerability Status */}
                                    <Card className={node.output.sqlmap_scan.is_vulnerable || node.output.sqlmap_scan.vulnerable 
                                      ? "bg-zinc-800/50 border-red-500/70 mb-4" 
                                      : "bg-zinc-800/50 border-emerald-500/30 mb-4"
                                    }>
                                      <CardContent className="pt-6">
                                        <div className="flex items-center gap-3 mb-3">
                                          <Badge variant={node.output.sqlmap_scan.is_vulnerable || node.output.sqlmap_scan.vulnerable ? "destructive" : "default"} className="text-sm px-3 py-1">
                                            {node.output.sqlmap_scan.is_vulnerable || node.output.sqlmap_scan.vulnerable ? "VULNERABLE" : "SECURE"}
                                          </Badge>
                                          {node.output.sqlmap_scan.dbms && (
                                            <span className="text-sm font-medium text-gray-200">
                                              Database: {node.output.sqlmap_scan.dbms}
                                            </span>
                                          )}
                                        </div>
                                        
                                        {/* Vulnerability Details */}
                                        {node.output.sqlmap_scan.vulnerabilities && node.output.sqlmap_scan.vulnerabilities.length > 0 && (
                                          <div className="mt-3 space-y-2">
                                            <span className="text-xs font-semibold text-white">Detected Vulnerabilities:</span>
                                            {node.output.sqlmap_scan.vulnerabilities.map((vuln: string, i: number) => {
                                              // Parse vulnerability details
                                              const isTitle = vuln.toLowerCase().includes('title:');
                                              const isPayload = vuln.toLowerCase().includes('payload:');
                                              const isParameter = vuln.toLowerCase().includes('parameter:');
                                              const isType = vuln.toLowerCase().includes('type:');
                                              const isDbms = vuln.toLowerCase().includes('dbms:');
                                              
                                              return (
                                                <div 
                                                  key={i} 
                                                  className={`text-sm p-2 rounded ${
                                                    isTitle ? 'bg-zinc-700/50 font-semibold text-white' :
                                                    isParameter ? 'bg-zinc-700/30 font-semibold text-emerald-400' :
                                                    isType ? 'bg-zinc-700/30 font-medium text-blue-400' :
                                                    isPayload ? 'bg-zinc-700/30 text-gray-300 font-mono text-xs' :
                                                    isDbms ? 'bg-zinc-700/30 font-medium text-cyan-400' :
                                                    'bg-zinc-800/50 text-gray-200'
                                                  }`}
                                                >
                                                  {isPayload && vuln.length > 100 ? vuln.substring(0, 100) + '...' : vuln}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                        
                                        {!node.output.sqlmap_scan.is_vulnerable && !node.output.sqlmap_scan.vulnerable && (
                                          <p className="text-sm text-emerald-300 mt-2">
                                            No SQL injection vulnerabilities detected in the scanned parameters.
                                          </p>
                                        )}
                                      </CardContent>
                                    </Card>

                                    {/* Raw Output Preview */}
                                    {node.output.sqlmap_scan.raw_output && (
                                      <Card className="bg-zinc-800/50 border-emerald-500/20">
                                        <CardContent className="pt-4">
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-semibold text-white">Raw SQLMap Output</h4>
                                            <Button 
                                              variant="outline" 
                                              size="sm"
                                              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                              onClick={() => {
                                                const output = node.output.sqlmap_scan.raw_output;
                                                const blob = new Blob([output], { type: 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `sqlmap-output-${new Date().getTime()}.txt`;
                                                a.click();
                                              }}
                                            >
                                              Download Full Output
                                            </Button>
                                          </div>
                                          <pre className="text-xs bg-black text-emerald-400 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto font-mono">
                                            {node.output.sqlmap_scan.raw_output.substring(0, 2000)}
                                            {node.output.sqlmap_scan.raw_output.length > 2000 && '\n... (truncated, click Download for full output)'}
                                          </pre>
                                        </CardContent>
                                      </Card>
                                    )}
                                  </div>
                                )}
                                
                                {/* Total Findings */}
                                {node.output?.total_findings !== undefined && (
                                  <div className="p-3 bg-zinc-800/50 rounded-lg border border-emerald-500/20">
                                    <span className="text-sm font-semibold text-white">
                                      Total Findings: <span className="text-emerald-400">{node.output.total_findings}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Gobuster - Exposed Directories/Files */}
                            {node.nodeType === 'gobuster' && (
                              <div className="space-y-4">
                                {/* Raw Gobuster Results */}
                                {node.output && (node.output.directories_found || node.output.files_found) && (
                                  <div>
                                    <h4 className="text-base font-semibold mb-4 text-white flex items-center gap-3">
                                      <span className="text-xl">�</span>
                                      Gobuster Scan Results
                                    </h4>
                                    
                                    {/* Directories */}
                                    {node.output.directories_found && node.output.directories_found.length > 0 && (
                                      <Card className="bg-zinc-800/50 border-emerald-500/20 mb-4">
                                        <CardContent className="pt-6">
                                          <h5 className="text-base font-semibold mb-3 text-white">
                                            📁 Directories ({node.output.directories_found.length})
                                          </h5>
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {node.output.directories_found.map((dir: any, idx: number) => (
                                              <div key={idx} className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg text-sm border border-emerald-500/10">
                                                <code className="text-emerald-400">{dir.path || dir}</code>
                                                {dir.status && (
                                                  <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                                                    {dir.status}
                                                  </Badge>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}
                                    
                                    {/* Files */}
                                    {node.output.files_found && node.output.files_found.length > 0 && (
                                      <Card className="bg-zinc-800/50 border-emerald-500/20">
                                        <CardContent className="pt-6">
                                          <h5 className="text-base font-semibold mb-3 text-white">
                                            📄 Files ({node.output.files_found.length})
                                          </h5>
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {node.output.files_found.map((file: any, idx: number) => (
                                              <div key={idx} className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg text-sm border border-emerald-500/10">
                                                <code className="text-emerald-400">{file.path || file}</code>
                                                {file.status && (
                                                  <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                                                    {file.status}
                                                  </Badge>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Nikto - Web Server Vulnerabilities */}
                            {node.nodeType === 'nikto' && (
                              <div className="space-y-4">
                                {/* Show raw Nikto vulnerabilities */}
                                {node.output?.nikto_scan?.vulnerabilities && node.output.nikto_scan.vulnerabilities.length > 0 ? (
                                  <div>
                                    <h4 className="text-base font-semibold mb-4 text-white flex items-center gap-3">
                                      <span className="text-xl">🌐</span>
                                      Nikto Scan Results
                                    </h4>
                                    <Card className="bg-zinc-800/50 border-emerald-500/20">
                                      <CardContent className="pt-6">
                                        <h5 className="text-base font-semibold mb-3 text-white">
                                          Found {node.output.nikto_scan.vulnerabilities.length} Issues
                                        </h5>
                                        {node.output.nikto_scan.server_info && (
                                          <div className="mb-4 text-base text-gray-300">
                                            <span className="font-semibold text-white">Server:</span> {node.output.nikto_scan.server_info}
                                          </div>
                                        )}
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                          {node.output.nikto_scan.vulnerabilities.map((vuln: any, idx: number) => {
                                            const vulnText = typeof vuln === 'string' ? vuln : (vuln.msg || vuln.message || vuln.description || JSON.stringify(vuln));
                                            const uri = typeof vuln === 'object' ? (vuln.uri || vuln.url || '') : '';
                                            
                                            return (
                                              <div key={idx} className="bg-zinc-900/50 p-4 rounded-lg border border-emerald-500/10">
                                                <div className="text-base text-gray-200 mb-2">
                                                  {vulnText}
                                                </div>
                                                {uri && (
                                                  <code className="text-sm text-emerald-400">
                                                    {uri}
                                                  </code>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>
                                ) : (
                                  /* No vulnerabilities found */
                                  <Card className="bg-zinc-800/50 border-emerald-500/30">
                                    <CardContent className="pt-6">
                                      <p className="text-base text-emerald-300">
                                        ✅ Nikto scan completed. No major vulnerabilities detected.
                                      </p>
                                    </CardContent>
                                  </Card>
                                )}
                              </div>
                            )}

                            {/* Recommendations */}
                            {node.detailedAnalysis.recommendations && node.detailedAnalysis.recommendations.length > 0 && (
                              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                                <h4 className="text-base font-semibold text-white mb-3">
                                  💡 Recommendations
                                </h4>
                                <ul className="list-disc list-inside text-base text-gray-300 space-y-2 ml-2">
                                  {node.detailedAnalysis.recommendations.map((rec: string, idx: number) => (
                                    <li key={idx}>{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {selectedReport.executionErrors.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-red-600 dark:text-red-400">Errors</h3>
                  <div className="space-y-2">
                    {selectedReport.executionErrors.map((error, index) => (
                      <Card key={index} className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
                            <div>
                              <div className="font-medium text-red-900 dark:text-red-100">
                                {error.nodeType || "General Error"}
                              </div>
                              <div className="text-sm text-red-800 dark:text-red-200">{error.message}</div>
                              <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                                {new Date(error.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
