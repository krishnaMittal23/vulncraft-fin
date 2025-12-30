import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WorkflowProgress {
  workflowId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentNode?: {
    nodeId: string;
    nodeType: string;
    status: 'running' | 'completed' | 'failed';
    duration?: number;
    executionLevel?: number;
    mode?: 'sequential' | 'parallel';
  };
  currentLevel?: {
    level: number;
    totalLevels: number;
    nodeCount: number;
    completedNodes: number;
    failedNodes: number;
  };
  completedNodes: Array<{
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'failed';
    duration: number;
    executionLevel?: number;
    error?: string;
  }>;
  totalNodes: number;
  duration?: number;
  findings?: any;
  reportId?: string;
  executionMode?: 'sequential' | 'parallel';
  error?: string;
  logs?: Array<{
    timestamp: Date;
    level: string;
    message: string;
    nodeId?: string;
    nodeType?: string;
    source?: string;
  }>;
}

interface UseWorkflowSocketReturn {
  isConnected: boolean;
  progress: WorkflowProgress | null;
  joinWorkflow: (workflowId: string) => void;
  leaveWorkflow: (workflowId: string) => void;
  clearProgress: () => void;
}

export function useWorkflowSocket(): UseWorkflowSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    socketRef.current = io(BACKEND_URL, {
      withCredentials: true,
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('📡 Connected to Socket.IO server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('📡 Disconnected from Socket.IO server');
      setIsConnected(false);
    });

    // Workflow events
    socket.on('workflow-started', (data) => {
      console.log('📡 Workflow started:', data);
      setProgress({
        workflowId: data.workflowId,
        status: 'running',
        completedNodes: [],
        totalNodes: data.totalNodes || 0,
        reportId: data.reportId,
        executionMode: data.executionMode,
        logs: [],
      });
    });

    socket.on('workflow-completed', (data) => {
      console.log('📡 Workflow completed:', data);
      setProgress(prev => prev ? {
        ...prev,
        status: 'completed',
        duration: data.duration,
        findings: data.findings,
      } : null);
    });

    socket.on('workflow-failed', (data) => {
      console.log('📡 Workflow failed:', data);
      setProgress(prev => prev ? {
        ...prev,
        status: 'failed',
        error: data.error,
      } : null);
    });

    // Execution log streaming
    socket.on('execution-log', (data) => {
      setProgress(prev => {
        if (!prev) return null;
        
        const newLog = {
          timestamp: data.timestamp,
          level: data.level,
          message: data.message,
          nodeId: data.nodeId,
          nodeType: data.nodeType,
          source: data.source,
        };

        return {
          ...prev,
          logs: [...(prev.logs || []), newLog],
        };
      });
    });

    // Node events
    socket.on('node-started', (data) => {
      console.log('📡 Node started:', data);
      setProgress(prev => prev ? {
        ...prev,
        currentNode: {
          nodeId: data.nodeId,
          nodeType: data.nodeType,
          status: 'running',
          executionLevel: data.executionLevel,
          mode: data.mode,
        },
      } : null);
    });

    socket.on('node-completed', (data) => {
      console.log('📡 Node completed:', data);
      setProgress(prev => {
        if (!prev) return null;
        
        const newCompletedNode = {
          nodeId: data.nodeId,
          nodeType: data.nodeType,
          status: 'completed' as const,
          duration: data.duration,
          executionLevel: data.executionLevel,
        };

        return {
          ...prev,
          currentNode: undefined,
          completedNodes: [...prev.completedNodes, newCompletedNode],
        };
      });
    });

    socket.on('node-failed', (data) => {
      console.log('📡 Node failed:', data);
      setProgress(prev => {
        if (!prev) return null;
        
        const newFailedNode = {
          nodeId: data.nodeId,
          nodeType: data.nodeType,
          status: 'failed' as const,
          duration: data.duration,
          executionLevel: data.executionLevel,
          error: data.error,
        };

        return {
          ...prev,
          currentNode: undefined,
          completedNodes: [...prev.completedNodes, newFailedNode],
        };
      });
    });

    // Level events (for parallel execution)
    socket.on('level-started', (data) => {
      console.log('📡 Level started:', data);
      setProgress(prev => prev ? {
        ...prev,
        currentLevel: {
          level: data.level,
          totalLevels: data.totalLevels,
          nodeCount: data.nodeCount,
          completedNodes: 0,
          failedNodes: 0,
        },
      } : null);
    });

    socket.on('level-completed', (data) => {
      console.log('📡 Level completed:', data);
      setProgress(prev => prev ? {
        ...prev,
        currentLevel: prev.currentLevel ? {
          ...prev.currentLevel,
          completedNodes: data.successfulNodes,
          failedNodes: data.failedNodes,
        } : undefined,
      } : null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinWorkflow = (workflowId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-workflow', workflowId);
      console.log(`📡 Joined workflow room: ${workflowId}`);
    }
  };

  const leaveWorkflow = (workflowId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-workflow', workflowId);
      console.log(`📡 Left workflow room: ${workflowId}`);
    }
  };

  const clearProgress = () => {
    setProgress(null);
  };

  return {
    isConnected,
    progress,
    joinWorkflow,
    leaveWorkflow,
    clearProgress,
  };
}