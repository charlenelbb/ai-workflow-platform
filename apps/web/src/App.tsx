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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
  const [activeRunTab, setActiveRunTab] = useState<'logs' | 'outputs' | 'raw'>('logs');

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
        setActiveRunTab('logs');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRunResult({ error: msg });
        setUiError(`运行失败：${msg}`);
        setActiveRunTab('raw');
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
        setActiveRunTab('raw');
        return;
      }
      await handleRun(parsed as Record<string, unknown>);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRunResult({ error: `运行输入 JSON 解析失败: ${msg}` });
      setUiError(`运行输入 JSON 解析失败: ${msg}`);
      setActiveRunTab('raw');
    }
  }, [current, runInputsText, handleRun]);

  if (loading) return <div className="p-6">加载中…</div>;

  const nodeLogs =
    runResult && typeof runResult === 'object' && runResult != null && 'nodeLogs' in runResult
      ? ((runResult as { nodeLogs?: unknown }).nodeLogs as unknown)
      : null;
  const outputs =
    runResult && typeof runResult === 'object' && runResult != null && 'outputs' in runResult
      ? (runResult as { outputs?: unknown }).outputs
      : null;

  return (
    <div className="grid h-screen grid-cols-[260px_1fr_420px]">
      <aside className="flex flex-col overflow-auto border-r border-border p-4">
        {uiError && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive whitespace-pre-wrap">
            {uiError}
          </div>
        )}
        <Button type="button" className="mb-3 w-full font-semibold" onClick={newWorkflow}>
          + 新建工作流
        </Button>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">工作流</div>
        <ScrollArea className="flex-1 pr-2">
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
        </ScrollArea>

        <Separator className="my-4" />
        <div>
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
      <main className="min-w-0">
        <WorkflowEditor
          key={current?.id ?? 'new'}
          workflowId={current?.id ?? null}
          initialGraph={current ? (current.graph as WorkflowGraph) : null}
          onSave={handleSave}
          onRun={current ? runWithEditorInputs : undefined}
        />
      </main>
      <aside className="border-l border-border bg-muted/20 p-4">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">运行面板</CardTitle>
              {runResult ? (
                <Badge variant="secondary">有结果</Badge>
              ) : (
                <Badge variant="outline">未运行</Badge>
              )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {current?.name ? `当前：${current.name}` : '请选择或新建一个工作流'}
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-84px)]">
            <Tabs value={activeRunTab} onValueChange={(v) => setActiveRunTab(v as typeof activeRunTab)} className="h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="logs">日志</TabsTrigger>
                <TabsTrigger value="outputs">Outputs</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <div className="mt-3 h-[calc(100%-44px)]">
                <TabsContent value="logs" className="m-0 h-full">
                  <ScrollArea className="h-full pr-3">
                    {Array.isArray(nodeLogs) ? (
                      <div className="flex flex-col gap-2">
                        {(nodeLogs as Array<{ nodeId: string; status: string; input?: unknown; output?: unknown; error?: string }>).map(
                          (log, i) => (
                            <div
                              key={i}
                              className={`rounded-lg border p-3 ${
                                log.status === 'failed'
                                  ? 'border-destructive/40 bg-destructive/10'
                                  : 'border-border bg-card'
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <div className="font-mono text-xs font-semibold">{log.nodeId}</div>
                                <Badge variant={log.status === 'failed' ? 'destructive' : 'secondary'}>
                                  {log.status}
                                </Badge>
                              </div>
                              {log.error && <div className="mb-2 text-xs text-destructive">{log.error}</div>}
                              <details className="mb-2">
                                <summary className="cursor-pointer text-xs text-muted-foreground">输入</summary>
                                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[11px]">
                                  {JSON.stringify(log.input ?? {}, null, 2)}
                                </pre>
                              </details>
                              <details>
                                <summary className="cursor-pointer text-xs text-muted-foreground">输出</summary>
                                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[11px]">
                                  {JSON.stringify(log.output ?? {}, null, 2)}
                                </pre>
                              </details>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">暂无日志。点击“运行当前工作流”开始。</div>
                    )}
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="outputs" className="m-0 h-full">
                  <ScrollArea className="h-full pr-3">
                    <pre className="whitespace-pre-wrap rounded-lg bg-card p-3 text-[11px]">
                      {JSON.stringify(outputs ?? {}, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="raw" className="m-0 h-full">
                  <ScrollArea className="h-full pr-3">
                    <pre className="whitespace-pre-wrap rounded-lg bg-card p-3 text-[11px]">
                      {JSON.stringify(runResult ?? {}, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
