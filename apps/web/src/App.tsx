import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, FileOutput, Code2, Plus } from 'lucide-react';
import { WorkflowEditor } from '@/features/workflow-editor/WorkflowEditor';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  publishWorkflow,
  startRun,
  getRun,
  getRunsByWorkflow,
  type WorkflowDetail,
  type WorkflowListItem,
} from '@/api/client';
import type { WorkflowGraph } from '@/types/workflow';
import {
  TopNavBar,
  CollapsibleSidePanel,
  ResizablePanel,
  NodeCard,
  WorkflowListRow,
  PublishShareSheet,
} from '@/components/layout';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const defaultGraph: WorkflowGraph = {
  nodes: [
    {
      id: 'input-default',
      type: 'input',
      position: { x: 250, y: 0 },
      data: { label: '输入', assignments: { message: '' } },
    },
    {
      id: 'output-default',
      type: 'output',
      position: { x: 250, y: 200 },
      data: { label: '输出', outputMapping: { result: '{{input-default.message}}' } },
    },
  ],
  edges: [{ id: 'e1', source: 'input-default', target: 'output-default' }],
};

export default function App() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [current, setCurrent] = useState<WorkflowDetail | null>(null);
  const [runResult, setRunResult] = useState<unknown>(null);
  const [runHistory, setRunHistory] = useState<Array<{ id: string; status: string; startedAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);
  const [activeRunTab, setActiveRunTab] = useState<'logs' | 'outputs' | 'raw'>('logs');
  const [runPolling, setRunPolling] = useState(false);
  /** 当前轮询的 runId，仅用于 effect 依赖，避免因 runResult 变化导致重复建 interval、请求暴增 */
  const [runIdToPoll, setRunIdToPoll] = useState<string | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saveTriggerToken, setSaveTriggerToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /** workflowId -> 对外 appId（发布成功后写入，并持久化 localStorage） */
  const [appIdByWorkflowId, setAppIdByWorkflowId] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('ai-workflow-published-app-ids');
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [publishSheet, setPublishSheet] = useState<{
    appId: string;
    embedApiKey?: string;
  } | null>(null);

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
      const runs = await getRunsByWorkflow(id, 20);
      setRunHistory(
        (runs as Array<{ id: string; status: string; startedAt: string }>).map((r) => ({
          id: r.id,
          status: r.status,
          startedAt: r.startedAt,
        })),
      );
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
      setRunHistory([]);
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

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      try {
        setUiError(null);
        const updated = await updateWorkflow(id, { name: trimmed });
        setWorkflows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, name: updated.name } : w)),
        );
        if (current?.id === id) setCurrent(updated);
        setEditingWorkflowId(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setUiError(`重命名失败：${msg}`);
      }
    },
    [current?.id],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('确定要删除此工作流吗？')) return;
      try {
        setUiError(null);
        await deleteWorkflow(id);
        setWorkflows((prev) => prev.filter((w) => w.id !== id));
        if (current?.id === id) {
          setCurrent(null);
          setRunResult(null);
          setRunHistory([]);
        }
        setEditingWorkflowId(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setUiError(`删除失败：${msg}`);
      }
    },
    [current?.id],
  );

  const loadRunHistory = useCallback(async () => {
    if (!current?.id) return;
    try {
      const runs = await getRunsByWorkflow(current.id, 20);
      setRunHistory(
        (runs as Array<{ id: string; status: string; startedAt: string }>).map((r) => ({
          id: r.id,
          status: r.status,
          startedAt: r.startedAt,
        })),
      );
    } catch {
      setRunHistory([]);
    }
  }, [current?.id]);

  const handleRun = useCallback(
    async (inputs: Record<string, unknown>) => {
      if (!current) return;
      try {
        setUiError(null);
        const result = await startRun(current.id, inputs);
        setRunResult(result);
        setActiveRunTab('logs');
        const r = result as { runId?: string; status?: string };
        if (r.status === 'pending' || r.status === 'running') {
          setRunIdToPoll(r.runId ?? null);
          setRunPolling(true);
        } else {
          setRunIdToPoll(null);
          loadRunHistory();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRunResult({ error: msg });
        setUiError(`运行失败：${msg}`);
        setActiveRunTab('raw');
      }
    },
    [current, loadRunHistory],
  );

  // 轮询运行状态：只依赖 runPolling + runIdToPoll，避免 runResult 每次更新都重建 interval 导致请求暴增
  const RUN_POLL_INTERVAL_MS = 2000;

  useEffect(() => {
    if (!runPolling || !runIdToPoll) return;
    const runId = runIdToPoll;

    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const updated = await getRun(runId, true);
        if (cancelled) return;
        const s = (updated as { status?: string }).status;
        setRunResult(updated);
        if (s === 'success' || s === 'failed') {
          setRunPolling(false);
          setRunIdToPoll(null);
          loadRunHistory();
        }
      } catch {
        if (!cancelled) {
          setRunPolling(false);
          setRunIdToPoll(null);
        }
      }
    };

    fetchStatus(); // 立即请求一次
    const interval = setInterval(fetchStatus, RUN_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [runPolling, runIdToPoll, loadRunHistory]);

  const runCurrentWorkflow = useCallback(async () => {
    if (!current) return;
    await handleRun({});
  }, [current, handleRun]);

  const selectRunFromHistory = useCallback(async (runId: string) => {
    try {
      const run = await getRun(runId);
      setRunResult(run);
      setActiveRunTab('logs');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUiError(`加载运行详情失败：${msg}`);
    }
  }, []);

  const triggerSave = useCallback(() => {
    setSaveTriggerToken((t) => t + 1);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!current) return;
    setUiError(null);
    triggerSave();
    await new Promise((r) => setTimeout(r, 450));
    setPublishing(true);
    try {
      const { appId, apiKey: embedApiKey } = await publishWorkflow(current.id);
      setAppIdByWorkflowId((prev) => {
        const next = { ...prev, [current.id]: appId };
        try {
          localStorage.setItem('ai-workflow-published-app-ids', JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      const w = await getWorkflow(current.id);
      setCurrent(w);
      setPublishSheet({ appId, embedApiKey });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUiError(`发布失败：${msg}`);
    } finally {
      setPublishing(false);
    }
  }, [current, triggerSave]);

  const openPublishSheet = useCallback(() => {
    if (!current?.id) return;
    const appId = appIdByWorkflowId[current.id];
    if (appId) setPublishSheet({ appId });
  }, [current?.id, appIdByWorkflowId]);

  const nodeLogs =
    runResult && typeof runResult === 'object' && runResult != null && 'nodeLogs' in runResult
      ? ((runResult as { nodeLogs?: unknown }).nodeLogs as unknown)
      : null;
  const outputs =
    runResult && typeof runResult === 'object' && runResult != null && 'outputs' in runResult
      ? (runResult as { outputs?: unknown }).outputs
      : null;
  const runStatus =
    runResult && typeof runResult === 'object' && runResult != null && 'status' in runResult
      ? (runResult as { status?: string }).status
      : null;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-screen items-center justify-center bg-background"
      >
        <span className="text-muted-foreground">加载中…</span>
      </motion.div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶部：固定导航栏 */}
      <TopNavBar
        workflowName={current?.name ?? '未命名工作流'}
        onWorkflowNameChange={(name) => current && handleRename(current.id, name)}
        onSave={() => triggerSave()}
        onRun={runCurrentWorkflow}
        onPublish={handlePublish}
        publishing={publishing}
        publishedAppId={current?.id ? appIdByWorkflowId[current.id] ?? null : null}
        onOpenPublishSheet={openPublishSheet}
        hasWorkflow={!!current?.id}
        saving={saving}
        running={runPolling}
      />

      <AnimatePresence mode="wait">
        {publishSheet ? (
          <PublishShareSheet
            key={`${publishSheet.appId}:${publishSheet.embedApiKey ?? ''}`}
            appId={publishSheet.appId}
            embedApiKey={publishSheet.embedApiKey}
            onClose={() => setPublishSheet(null)}
          />
        ) : null}
      </AnimatePresence>

      <div className="flex flex-1 min-h-0">
        {/* 左侧：可折叠工作流列表 */}
        <CollapsibleSidePanel side="left" width={260} defaultCollapsed={false}>
          <div className="flex flex-col p-4 h-full gap-2">
            <AnimatePresence mode="wait">
              {uiError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 overflow-hidden rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-2.5 text-xs text-[var(--destructive)] whitespace-pre-wrap"
                >
                  {uiError}
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              type="button"
              className="mb-4 h-9 w-full rounded-md bg-[var(--primary)] font-semibold text-white hover:bg-[var(--primary-hover)]"
              onClick={newWorkflow}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建工作流
            </Button>
            <h2 className="mb-2 text-base font-bold text-foreground">工作流</h2>
            <ScrollArea className="flex-1 pr-2">
              <ul className="m-0 flex flex-col gap-0.5 list-none p-0">
                {workflows.map((w) => (
                  <WorkflowListRow
                    key={w.id}
                    workflow={w}
                    isSelected={current?.id === w.id}
                    isEditing={editingWorkflowId === w.id}
                    editingName={editingName}
                    onSelect={() => openWorkflow(w.id)}
                    onDelete={() => handleDelete(w.id)}
                    onStartEdit={() => {
                      setEditingWorkflowId(w.id);
                      setEditingName(w.name);
                    }}
                    onEditingNameChange={setEditingName}
                    onEditingKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') handleRename(w.id, editingName);
                      if (e.key === 'Escape') setEditingWorkflowId(null);
                    }}
                    onEditingBlur={() => {
                      if (editingName.trim()) handleRename(w.id, editingName);
                      else setEditingWorkflowId(null);
                    }}
                  />
                ))}
              </ul>
            </ScrollArea>
          </div>
        </CollapsibleSidePanel>

        {/* 中间：无工作流时仅引导新建，有工作流时显示画布 */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!current ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-muted/20 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Plus className="h-10 w-10" strokeWidth={1.5} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-foreground">还没有打开工作流</p>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  请从左侧点击「新建工作流」开始，或选择已有工作流进行编辑
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="h-11 rounded-lg bg-[var(--primary)] px-6 font-semibold text-white hover:bg-[var(--primary-hover)]"
                onClick={newWorkflow}
              >
                <Plus className="mr-2 h-5 w-5" />
                新建工作流
              </Button>
            </div>
          ) : (
            <WorkflowEditor
              key={current.id}
              workflowId={current.id}
              initialGraph={current.graph as WorkflowGraph}
              onSave={handleSave}
              onRun={runCurrentWorkflow}
              triggerSaveToken={saveTriggerToken}
              onSavingChange={setSaving}
              executionNodeLogs={Array.isArray(nodeLogs) ? (nodeLogs as Array<{ nodeId: string; status: string }>) : null}
              executionRunStatus={runStatus}
            />
          )}
        </main>

        {/* 右侧：可拖拽调整宽度的运行面板，默认 320px */}
        <ResizablePanel side="right" defaultWidth={320}>
          <div className="flex h-full flex-col border-l border-border bg-card">
            <CardHeader className="shrink-0 p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">运行面板</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    runPolling
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : runResult
                        ? runStatus === 'failed'
                          ? 'border-[var(--destructive)] bg-[var(--destructive)]/10 text-[var(--destructive)]'
                          : runStatus === 'success'
                            ? 'border-[#00B42A] bg-[#00B42A]/10 text-[#00B42A]'
                            : 'border-[var(--muted-foreground)] text-muted-foreground'
                        : 'border-[var(--muted-foreground)] text-muted-foreground'
                  }
                >
                  {runPolling ? '运行中…' : runResult ? (runStatus === 'success' ? '成功' : runStatus === 'failed' ? '失败' : '有结果') : '未运行'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {current?.name ? `当前：${current.name}` : '请选择或新建一个工作流'}
              </p>
              {runHistory.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-xs font-semibold text-muted-foreground">运行历史</div>
                  <ScrollArea className="h-20 rounded-lg border border-border">
                    <ul className="m-0 list-none p-2">
                      {runHistory.map((r, i) => (
                        <motion.li
                          key={r.id}
                          initial={{ opacity: 0, x: 4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto w-full justify-between rounded-md px-2 py-2 text-xs font-normal hover:bg-[var(--muted)]"
                            onClick={() => selectRunFromHistory(r.id)}
                          >
                            <span className="truncate font-mono">{r.id.slice(0, 8)}…</span>
                            <Badge
                              variant="outline"
                              className={
                                r.status === 'failed'
                                  ? 'border-[var(--destructive)] text-[var(--destructive)]'
                                  : r.status === 'success'
                                    ? 'border-[#00B42A] text-[#00B42A]'
                                    : 'text-muted-foreground'
                              }
                            >
                              {r.status}
                            </Badge>
                          </Button>
                        </motion.li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col overflow-hidden p-4 pt-0">
              {/* 下划线式标签页 */}
              <Tabs
                value={activeRunTab}
                onValueChange={(v) => setActiveRunTab(v as typeof activeRunTab)}
                className="flex h-full flex-col"
              >
                <TabsList variant="line" className="h-9 w-full justify-start rounded-none border-b border-border bg-transparent p-0">
                  <TabsTrigger value="logs" className="gap-1.5 rounded-none border-b-2 border-transparent data-active:border-[var(--primary)] data-active:text-[var(--primary)] data-active:shadow-none">
                    <ScrollText className="h-3.5 w-3.5" />
                    日志
                  </TabsTrigger>
                  <TabsTrigger value="outputs" className="gap-1.5 rounded-none border-b-2 border-transparent data-active:border-[var(--primary)] data-active:text-[var(--primary)]">
                    <FileOutput className="h-3.5 w-3.5" />
                    Outputs
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="gap-1.5 rounded-none border-b-2 border-transparent data-active:border-[var(--primary)] data-active:text-[var(--primary)]">
                    <Code2 className="h-3.5 w-3.5" />
                    Raw
                  </TabsTrigger>
                </TabsList>
                <div className="mt-3 flex-1 min-h-0">
                  <TabsContent value="logs" className="m-0 h-full data-[state=inactive]:hidden">
                    <ScrollArea className="h-full pr-2">
                      {Array.isArray(nodeLogs) ? (
                        <div className="flex flex-col gap-2">
                          {(nodeLogs as Array<{ nodeId: string; status: string; input?: unknown; output?: unknown; error?: string }>).map(
                            (log, i) => (
                              <NodeCard key={i} log={log} index={i} />
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border bg-[var(--muted)]/30 p-6 text-center text-sm text-muted-foreground">
                          暂无日志。点击「运行当前工作流」开始。
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="outputs" className="m-0 h-full data-[state=inactive]:hidden">
                    <ScrollArea className="h-full pr-2">
                      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                          {JSON.stringify(outputs ?? {}, null, 2)}
                        </pre>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="raw" className="m-0 h-full data-[state=inactive]:hidden">
                    <ScrollArea className="h-full pr-2">
                      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                          {JSON.stringify(runResult ?? {}, null, 2)}
                        </pre>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </div>
        </ResizablePanel>
      </div>

    </div>
  );
}
