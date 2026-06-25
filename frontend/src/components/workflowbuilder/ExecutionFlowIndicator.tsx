import React from 'react';
import { Badge } from "@/components/ui/badge";
import type { WorkflowNode as WorkflowNodeType } from "@/types/workflow";
import type { Edge } from "reactflow";

interface ExecutionFlowIndicatorProps {
  nodes: WorkflowNodeType[];
  edges: Edge[];
}

interface ExecutionLevel {
  level: number;
  nodes: WorkflowNodeType[];
  isParallel: boolean;
}

export function ExecutionFlowIndicator({ nodes, edges }: ExecutionFlowIndicatorProps) {
  const calculateExecutionLevels = (): ExecutionLevel[] => {
    if (nodes.length <= 1) return [];

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    
    // Initialize
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    });
    
    // Build adjacency list and calculate in-degrees
    edges.forEach(edge => {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });
    
    const levels: ExecutionLevel[] = [];
    const queue: string[] = [];
    
    // Find all nodes with no incoming edges
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });
    
    let levelIndex = 0;
    while (queue.length > 0) {
      const currentLevel: WorkflowNodeType[] = [];
      const levelSize = queue.length;
      
      // Process all nodes at current level
      for (let i = 0; i < levelSize; i++) {
        const nodeId = queue.shift()!;
        const node = nodeMap.get(nodeId);
        if (node) {
          currentLevel.push(node);
        }
        
        // Process neighbors
        adjList.get(nodeId)?.forEach((neighborId: string) => {
          inDegree.set(neighborId, (inDegree.get(neighborId) || 0) - 1);
          if (inDegree.get(neighborId) === 0) {
            queue.push(neighborId);
          }
        });
      }
      
      if (currentLevel.length > 0) {
        // Filter out trigger node for execution level analysis
        const executableNodes = currentLevel.filter(node => node.type !== "trigger");
        if (executableNodes.length > 0) {
          levels.push({
            level: levelIndex + 1,
            nodes: executableNodes,
            isParallel: executableNodes.length > 1
          });
          levelIndex++;
        }
      }
    }
    
    return levels;
  };

  const executionLevels = calculateExecutionLevels();
  const hasParallelExecution = executionLevels.some(level => level.isParallel);

  if (executionLevels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Execution Flow:</span>
        <Badge variant={hasParallelExecution ? "default" : "secondary"}>
          {hasParallelExecution ? "Parallel" : "Sequential"}
        </Badge>
      </div>
      
      <div className="space-y-1">
        {executionLevels.map((level) => (
          <div
            key={level.level}
            className="flex items-center gap-2 text-xs"
          >
            <span className="w-12 text-muted-foreground">
              Level {level.level}:
            </span>
            <div className="flex items-center gap-1">
              {level.nodes.map((node, index) => {
                // Count how many nodes of this type exist in this level
                const sameTypeCount = level.nodes.filter(n => n.type === node.type).length;
                const sameTypeIndex = level.nodes.filter((n, i) => i <= index && n.type === node.type).length;
                
                return (
                  <React.Fragment key={node.id}>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${level.isParallel ? 'border-blue-500 text-blue-700' : 'border-gray-500'}`}
                    >
                      {node.type}
                      {sameTypeCount > 1 && (
                        <span className="ml-1 text-xs">
                          ({sameTypeIndex})
                        </span>
                      )}
                    </Badge>
                    {index < level.nodes.length - 1 && level.isParallel && (
                      <span className="text-blue-500">||</span>
                    )}
                    {index < level.nodes.length - 1 && !level.isParallel && (
                      <span className="text-gray-500">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {level.isParallel && (
              <Badge variant="secondary" className="text-xs">
                Parallel ({level.nodes.length} nodes)
              </Badge>
            )}
          </div>
        ))}
      </div>
      
      {hasParallelExecution && (
        <div className="text-xs text-muted-foreground">
          💡 This workflow will execute {executionLevels.filter(l => l.isParallel).length} level(s) in parallel for faster completion
        </div>
      )}
    </div>
  );
}