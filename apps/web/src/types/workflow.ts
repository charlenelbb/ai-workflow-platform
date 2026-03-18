/**
 * 与后端一致的前端类型定义（可与 packages/shared-types 对齐）
 */

export type NodeType =
  | 'trigger'
  | 'input'
  | 'start'
  | 'end'
  | 'plain'
  | 'ai'
  | 'http'
  | 'condition_if'
  | 'condition_switch'
  | 'output';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: number;
  graph: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
}
