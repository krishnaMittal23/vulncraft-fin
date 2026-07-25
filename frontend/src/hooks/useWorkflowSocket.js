import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '@/lib/constant';



export function useWorkflowSocket(){
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    // Initialize socket connection
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
          logs: [...prev.logs, newLog],
        };
      });
    });

    // Node events
    socket.on('node-started', (data) => {
      console.log('📡 Node started:', data);
      setProgress(prev => prev ? {
        ...prev,
        currentNode: { nodeId: data.nodeId, nodeType: data.nodeType, executionLevel: data.executionLevel, mode: data.mode },
      } : null);
    });

    socket.on('node-completed', (data) => {
      console.log('📡 Node completed:', data);
      setProgress(prev => {
        if (!prev) return null;
        
        const newCompletedNode = {
          nodeId: data.nodeId,
          nodeType: data.nodeType,
          status: 'completed',
          duration: data.duration,
          executionLevel: data.executionLevel,
        };

        return {
          ...prev,
          currentNode: null,
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
          status: 'failed',
          duration: data.duration,
          executionLevel: data.executionLevel,
          error: data.error,
        };

        return {
          ...prev,
          currentNode: null,
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
        } : null,
      } : null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinWorkflow = (workflowId) => {
    if (socketRef.current) {
      socketRef.current.emit('join-workflow', workflowId);
      console.log(`📡 Joined workflow room: ${workflowId}`);
    }
  };

  const leaveWorkflow = (workflowId) => {
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