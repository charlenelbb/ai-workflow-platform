/**
 * 工作流整体数据结构
 */

import type { WorkflowNode } from './node';
import type { WorkflowEdge } from './edge';

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  default?: unknown;
  description?: string;
}

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: WorkflowViewport;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  version: number;
  graph: WorkflowGraph;
  variables?: WorkflowVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  projectId?: string;
  graph: WorkflowGraph;
  variables?: WorkflowVariable[];
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  graph?: WorkflowGraph;
  variables?: WorkflowVariable[];
}
