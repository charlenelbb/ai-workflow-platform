import { useState, useCallback, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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

  if (loading) return <div className="p-6">加载中…</div>;

  return (
    <div className="flex h-screen">
      <aside className="flex w-[260px] flex-col overflow-auto border-r border-border p-4">
        {uiError && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive whitespace-pre-wrap">
            {uiError}
          </div>
        )}
        <Button type="button" className="mb-3 w-full font-semibold" onClick={newWorkflow}>
          + 新建工作流
        </Button>
        <ul className="m-0 list-none p-0">
          {workflows.map((w) => (
            <li key={w.id}>
              <Button
                type="button"
                variant={current?.id === w.id ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => openWorkflow(w.id)}
              >
                {w.name}
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-border pt-4">
          <Label className="mb-2 block font-semibold">运行输入（JSON）</Label>
          <Textarea
            value={runInputsText}
            onChange={(e) => setRunInputsText(e.target.value)}
            placeholder='{"message":"hello"}'
            rows={6}
            className="font-mono text-xs resize-y"
          />
          <Button
            type="button"
            className="mt-2.5 w-full font-semibold"
            onClick={runWithEditorInputs}
            disabled={!current?.id}
          >
            运行当前工作流
          </Button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <WorkflowEditor
          key={current?.id ?? 'new'}
          workflowId={current?.id ?? null}
          initialGraph={current ? (current.graph as WorkflowGraph) : null}
          onSave={handleSave}
          onRun={current ? runWithEditorInputs : undefined}
        />
        {runResult != null && (
          <div className="fixed bottom-0 left-[260px] right-0 z-10 max-h-80 overflow-auto bg-card border-t border-border p-4 font-mono text-xs text-foreground">
            <strong>运行结果</strong>
            {runResult && typeof runResult === 'object' && 'nodeLogs' in runResult && Array.isArray((runResult as { nodeLogs?: unknown }).nodeLogs) && (
              <div className="mt-3">
                <div className="mb-2 font-semibold">节点日志</div>
                <div className="flex flex-col gap-2">
                  {((runResult as { nodeLogs: Array<{ nodeId: string; status: string; input?: unknown; output?: unknown; error?: string }> }).nodeLogs).map((log, i) => (
                    <div
                      key={i}
                      className={`rounded-md border p-2.5 ${log.status === 'failed' ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted/50'}`}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-semibold">{log.nodeId}</span>
                        <span className={log.status === 'failed' ? 'text-destructive' : 'text-green-600'}>
                          {log.status}
                        </span>
                      </div>
                      {log.error && <div className="mb-1 text-destructive">{log.error}</div>}
                      {log.input != null && Object.keys(log.input as object).length > 0 && (
                        <details className="mb-1">
                          <summary className="cursor-pointer">输入</summary>
                          <pre className="mt-1 whitespace-pre-wrap text-[11px]">
                            {JSON.stringify(log.input, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.output != null && Object.keys(log.output as object).length > 0 && (
                        <details>
                          <summary className="cursor-pointer">输出</summary>
                          <pre className="mt-1 whitespace-pre-wrap text-[11px]">
                            {JSON.stringify(log.output, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer">原始 JSON</summary>
              <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(runResult, null, 2)}</pre>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
