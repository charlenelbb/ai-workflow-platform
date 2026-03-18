import { useState, useCallback } from 'react';
import { WorkflowEditor } from '@/features/workflow-editor/WorkflowEditor';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  startRun,
  type WorkflowDetail,
  type WorkflowListItem,
} from '@/api/client';
import type { WorkflowGraph } from '@/types/workflow';
import { useEffect } from 'react';

const defaultGraph: WorkflowGraph = {
  nodes: [
    { id: 'start', type: 'start', position: { x: 250, y: 0 }, data: {} },
    { id: 'end', type: 'end', position: { x: 250, y: 300 }, data: {} },
  ],
  edges: [{ id: 'e1', source: 'start', target: 'end' }],
};

export default function App() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [current, setCurrent] = useState<WorkflowDetail | null>(null);
  const [runResult, setRunResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    try {
      const list = await listWorkflows();
      setWorkflows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openWorkflow = useCallback(async (id: string) => {
    const w = await getWorkflow(id);
    setCurrent(w);
    setRunResult(null);
  }, []);

  const newWorkflow = useCallback(async () => {
    const w = await createWorkflow({
      name: `工作流 ${Date.now()}`,
      graph: defaultGraph,
    });
    setWorkflows((prev) => [{ ...w, description: w.description ?? null }, ...prev]);
    setCurrent(w);
    setRunResult(null);
  }, []);

  const handleSave = useCallback(
    async (graph: WorkflowGraph) => {
      if (!current) return;
      const updated = await updateWorkflow(current.id, { graph });
      setCurrent(updated);
    },
    [current],
  );

  const handleRun = useCallback(async () => {
    if (!current) return;
    try {
      const result = await startRun(current.id, {});
      setRunResult(result);
    } catch (e) {
      setRunResult({ error: String(e) });
    }
  }, [current]);

  if (loading) return <div style={{ padding: 24 }}>加载中…</div>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: 260,
          borderRight: '1px solid #e2e8f0',
          padding: 16,
          overflow: 'auto',
        }}
      >
        <button
          type="button"
          onClick={newWorkflow}
          style={{
            width: '100%',
            padding: '10px 16px',
            marginBottom: 12,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + 新建工作流
        </button>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {workflows.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => openWorkflow(w.id)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: current?.id === w.id ? '#e0e7ff' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                }}
              >
                {w.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WorkflowEditor
          key={current?.id ?? 'new'}
          workflowId={current?.id ?? null}
          initialGraph={current ? (current.graph as WorkflowGraph) : null}
          onSave={handleSave}
          onRun={current ? handleRun : undefined}
        />
        {runResult != null && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 260,
              right: 0,
              maxHeight: 320,
              overflow: 'auto',
              background: '#1e293b',
              color: '#e2e8f0',
              padding: 16,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            <strong>运行结果</strong>
            {runResult && typeof runResult === 'object' && 'nodeLogs' in runResult && Array.isArray((runResult as { nodeLogs?: unknown }).nodeLogs) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>节点日志</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {((runResult as { nodeLogs: Array<{ nodeId: string; status: string; input?: unknown; output?: unknown; error?: string }> }).nodeLogs).map((log, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 10,
                        background: log.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(30,41,59,0.8)',
                        borderRadius: 6,
                        border: '1px solid #334155',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>{log.nodeId}</span>
                        <span style={{ color: log.status === 'failed' ? '#f87171' : '#86efac' }}>
                          {log.status}
                        </span>
                      </div>
                      {log.error && (
                        <div style={{ color: '#f87171', marginBottom: 4 }}>{log.error}</div>
                      )}
                      {log.input != null && Object.keys(log.input as object).length > 0 && (
                        <details style={{ marginBottom: 4 }}>
                          <summary style={{ cursor: 'pointer' }}>输入</summary>
                          <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 11 }}>
                            {JSON.stringify(log.input, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.output != null && Object.keys(log.output as object).length > 0 && (
                        <details>
                          <summary style={{ cursor: 'pointer' }}>输出</summary>
                          <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 11 }}>
                            {JSON.stringify(log.output, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>原始 JSON</summary>
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(runResult, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
