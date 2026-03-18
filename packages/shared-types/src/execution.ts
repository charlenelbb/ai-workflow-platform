/**
 * 执行与日志数据结构
 */

export type RunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface NodeRunLog {
  nodeId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'success' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

export interface RunRecord {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: RunStatus;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  nodeLogs?: NodeRunLog[];
}

export interface StartRunDto {
  workflowId: string;
  inputs?: Record<string, unknown>;
}

export interface StartRunResponse {
  runId: string;
  status: RunStatus;
}
