const BASE = '/api';

export async function listWorkflows(projectId?: string): Promise<WorkflowListItem[]> {
  const url = projectId ? `${BASE}/workflows?projectId=${projectId}` : `${BASE}/workflows`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const res = await fetch(`${BASE}/workflows/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createWorkflow(body: CreateWorkflowBody): Promise<WorkflowDetail> {
  const res = await fetch(`${BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateWorkflow(
  id: string,
  body: UpdateWorkflowBody,
): Promise<WorkflowDetail> {
  const res = await fetch(`${BASE}/workflows/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteWorkflow(id: string): Promise<void> {
  const res = await fetch(`${BASE}/workflows/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

/** 发布当前工作流到 App；若服务端配置了自动生成嵌入密钥，会多返回一次性的 apiKey */
export async function publishWorkflow(workflowId: string): Promise<{ appId: string; apiKey?: string }> {
  const res = await fetch(`${BASE}/workflows/${encodeURIComponent(workflowId)}/publish`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startRun(workflowId: string, inputs?: Record<string, unknown>) {
  const res = await fetch(`${BASE}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowId, inputs: inputs ?? {} }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** @param noCache 为 true 时加时间戳参数，避免拿到缓存的旧状态 */
export async function getRun(runId: string, noCache = false) {
  const url = noCache ? `${BASE}/runs/${runId}?_t=${Date.now()}` : `${BASE}/runs/${runId}`;
  const res = await fetch(url, noCache ? { cache: 'no-store' } : undefined);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRunsByWorkflow(workflowId: string, limit = 20) {
  const res = await fetch(`${BASE}/runs/workflow/${workflowId}?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** 调用已发布应用（需 Bearer API Key） */
export interface PublishedAppRunResult {
  runId: string;
  status: 'success' | 'failed';
  outputs?: Record<string, unknown>;
  nodeLogs?: unknown;
  error?: string;
}

export async function runPublishedApp(
  appId: string,
  apiKey: string,
  inputs: Record<string, unknown>,
): Promise<PublishedAppRunResult> {
  const res = await fetch(`${BASE}/apps/${encodeURIComponent(appId)}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 类型占位，与后端返回结构一致
export interface WorkflowListItem {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  updatedAt: string;
}

export interface WorkflowDetail {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  /** 后端 draft | published */
  status?: string;
  graph: { nodes: unknown[]; edges: unknown[] };
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowBody {
  name: string;
  description?: string;
  graph: { nodes: unknown[]; edges: unknown[] };
}

export interface UpdateWorkflowBody {
  name?: string;
  description?: string;
  graph?: { nodes: unknown[]; edges: unknown[] };
}
