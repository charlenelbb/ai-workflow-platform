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
  const [runInputsText, setRunInputsText] = useState<string>('{}');
  const [uiError, setUiError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      setUiError(null);
      const list = await listWorkflows();
      setWorkflows(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUiError(`加载工作流列表失败：${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openWorkflow = useCallback(async (id: string) => {
    try {
      setUiError(null);
      const w = await getWorkflow(id);
      console.log('w', w);
      setCurrent(w);
      setRunResult(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUiError(`打开工作流失败：${msg}`);
    }
  }, []);

  const newWorkflow = useCallback(async () => {
    try {
      setUiError(null);
      const w = await createWorkflow({
        name: `工作流 ${Date.now()}`,
        graph: defaultGraph,
      });
      setWorkflows((prev) => [{ ...w, description: w.description ?? null }, ...prev]);
      setCurrent(w);
      setRunResult(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUiError(`新建工作流失败：${msg}`);
    }
  }, []);

  const handleSave = useCallback(
    async (graph: WorkflowGraph) => {
      if (!current) return;
      const updated = await updateWorkflow(current.id, { graph });
      setCurrent(updated);
    },
    [current],
  );

  const handleRun = useCallback(
    async (inputs: Record<string, unknown>) => {
      if (!current) return;
      try {
        setUiError(null);
        const result = await startRun(current.id, inputs);
        setRunResult(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRunResult({ error: msg });
        setUiError(`运行失败：${msg}`);
      }
    },
    [current],
  );

  const runWithEditorInputs = useCallback(async () => {
    if (!current) return;
    try {
      const parsed = JSON.parse(runInputsText || '{}');
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setRunResult({ error: '运行输入必须是 JSON 对象，例如：{"message":"hello"}' });
        setUiError('运行输入必须是 JSON 对象，例如：{"message":"hello"}');
        return;
      }
      await handleRun(parsed as Record<string, unknown>);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRunResult({ error: `运行输入 JSON 解析失败: ${msg}` });
      setUiError(`运行输入 JSON 解析失败: ${msg}`);
    }
  }, [current, runInputsText, handleRun]);

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
        {uiError && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#991b1b',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {uiError}
          </div>
        )}
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

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>运行输入（JSON）</div>
          <textarea
            value={runInputsText}
            onChange={(e) => setRunInputsText(e.target.value)}
            placeholder='{"message":"hello"}'
            rows={6}
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 12,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={runWithEditorInputs}
            disabled={!current?.id}
            style={{
              width: '100%',
              padding: '10px 16px',
              marginTop: 10,
              cursor: current?.id ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              background: current?.id ? '#6366f1' : '#c7d2fe',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
            }}
          >
            运行当前工作流
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WorkflowEditor
          key={current?.id ?? 'new'}
          workflowId={current?.id ?? null}
          initialGraph={current ? (current.graph as WorkflowGraph) : null}
          onSave={handleSave}
          onRun={current ? runWithEditorInputs : undefined}
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
