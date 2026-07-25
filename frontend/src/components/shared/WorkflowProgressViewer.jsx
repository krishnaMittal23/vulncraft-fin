import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap, 
  BarChart3,
  Timer,
  Activity,
  Terminal,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderArchive
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';



export function WorkflowProgressViewer({ progress, onDownloadLogs, onDownloadLogsZip }) {
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress.logs, showLogs]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const completedCount = progress.completedNodes.filter(n => n.status === 'completed').length;
  const failedCount = progress.completedNodes.filter(n => n.status === 'failed').length;
  const overallProgress = progress.totalNodes > 0 ? (progress.completedNodes.length / (progress.totalNodes - 1)) * 100 : 0;

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Workflow Execution Progress
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            {progress.executionMode === 'parallel' ? (
              <Zap className="w-3 h-3" />
            ) : (
              <BarChart3 className="w-3 h-3" />
            )}
            {progress.executionMode === 'parallel' ? 'Parallel' : 'Sequential'}
          </Badge>
          <Badge className={getStatusColor(progress.status)}>
            {getStatusIcon(progress.status)}
            <span className="ml-1 capitalize">{progress.status}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.completedNodes.length} / {progress.totalNodes - 1} nodes</span>
            {progress.duration && (
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatDuration(progress.duration)}
              </span>
            )}
          </div>
        </div>

        <Separator />

        {/* Current Execution Info */}
        {progress.status === 'running' && (
          <div className="space-y-3">
            {/* Current Node */}
            {progress.currentNode && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="animate-spin">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    Currently executing
                  </p>
                  {progress.currentNode.executionLevel && (
                    <p className="text-xs text-muted-foreground">
                      Level {progress.currentNode.executionLevel}
                      {progress.currentNode.mode === 'parallel' && ' (Parallel)'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Current Level (for parallel execution) */}
            {progress.currentLevel && progress.executionMode === 'parallel' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium text-sm">
                    Level {progress.currentLevel.level} of {progress.currentLevel.totalLevels}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {progress.currentLevel.nodeCount} nodes in parallel
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600">
                    ✓ {progress.currentLevel.completedNodes} completed
                  </span>
                  {progress.currentLevel.failedNodes > 0 && (
                    <span className="text-red-600">
                      ✗ {progress.currentLevel.failedNodes} failed
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-blue-600">
              {progress.totalNodes - progress.completedNodes.length - 1}
            </p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
        </div>

        {/* Node Results */}
        {progress.completedNodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Execution Results</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {progress.completedNodes.map((node, index) => (
                <div
                  key={`${node.nodeId}-${index}`}
                  className="flex items-center justify-between p-2 text-xs bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(node.status)}
                    <span className="font-medium">{node.nodeType}</span>
                    {node.executionLevel && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        L{node.executionLevel}
                      </Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {formatDuration(node.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {progress.status === 'failed' && progress.error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Execution Failed
            </p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
              {progress.error}
            </p>
          </div>
        )}

        {/* Completion Message */}
        {progress.status === 'completed' && progress.findings && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Execution Completed Successfully
            </p>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              Total findings: {progress.findings?.total ?? 0}
            </p>
          </div>
        )}

        {/* Execution Logs Section */}
        {progress.logs && progress.logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs"
              >
                <Terminal className="w-3 h-3 mr-1" />
                {showLogs ? 'Hide' : 'Show'} Execution Logs ({progress.logs.length})
                {showLogs ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
              </Button>
              {progress.reportId && (onDownloadLogs || onDownloadLogsZip) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download Logs
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onDownloadLogs && (
                      <DropdownMenuItem onClick={onDownloadLogs}>
                        <FileText className="w-4 h-4 mr-2" />
                        Download (.txt)
                      </DropdownMenuItem>
                    )}
                    {onDownloadLogsZip && (
                      <DropdownMenuItem onClick={onDownloadLogsZip}>
                        <FolderArchive className="w-4 h-4 mr-2" />
                        Download (by node)
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {showLogs && (
              <div className="relative">
                <ScrollArea className="h-64 w-full rounded-md border bg-gray-50 dark:bg-gray-900">
                  <div className="p-3 font-mono text-xs space-y-1">
                    {progress.logs && progress.logs.length > 0 ? (
                      <>
                        {progress.logs.map((log, index) => {
                          const logLevel = log.level.toLowerCase();
                          const levelColor = {
                            error: 'text-red-600 dark:text-red-400',
                            warning: 'text-yellow-600 dark:text-yellow-400',
                            info: 'text-blue-600 dark:text-blue-400',
                            docker: 'text-purple-600 dark:text-purple-400',
                          }[logLevel] || 'text-gray-600 dark:text-gray-400';

                          const levelBg = {
                            error: 'bg-red-100 dark:bg-red-900/20',
                            warning: 'bg-yellow-100 dark:bg-yellow-900/20',
                            info: 'bg-blue-100 dark:bg-blue-900/20',
                            docker: 'bg-purple-100 dark:bg-purple-900/20',
                          }[logLevel] || 'bg-gray-100 dark:bg-gray-800';

                          return (
                            <div
                              key={`${log.timestamp}-${index}`}
                              className={`p-2 rounded text-xs ${levelBg}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400 shrink-0 font-semibold">
                                  {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                                    hour12: false, 
                                    hour: '2-digit', 
                                    minute: '2-digit', 
                                    second: '2-digit' 
                                  })}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`${levelColor} shrink-0 text-[10px] px-1 py-0`}
                                >
                                  {log.level.toUpperCase()}
                                </Badge>
                                {log.source && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px] px-1 py-0 bg-gray-200 dark:bg-gray-700"
                                  >
                                    {log.source}
                                  </Badge>
                                )}
                                {log.nodeType && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px] px-1 py-0 bg-blue-100 dark:bg-blue-900"
                                  >
                                    {log.nodeType}
                                  </Badge>
                                )}
                                <span className="flex-1 break-all text-gray-800 dark:text-gray-200">
                                  {log.message}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {/* Auto-scroll anchor */}
                        <div ref={logsEndRef} />
                      </>
                    ) : (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No logs available yet. Logs will appear as the workflow executes.
                      </div>
                    )}
                  </div>
                </ScrollArea>
                {progress.status === 'running' && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-green-100 dark:bg-green-900 px-2 py-1 rounded-full text-[10px] text-green-700 dark:text-green-300">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    Live streaming
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}