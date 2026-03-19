import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
} from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Square,
  Box,
  ArrowDownToLine,
  Sparkles,
  ArrowUpFromLine,
  Globe,
  GitBranch,
  GitCompare,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './node-types';
import { NodeConfigPanel } from '@/features/node-config/NodeConfigPanel';
import { Button } from '@/components/ui/button';
import type { NodeType, WorkflowGraph } from '@/types/workflow';

const initialNodes: Node[] = [
  { id: 'start', type: 'start', position: { x: 250, y: 0 }, data: {} },
  { id: 'end', type: 'end', position: { x: 250, y: 300 }, data: {} },
];
const initialEdges: Edge[] = [{ id: 'e-start-end', source: 'start', target: 'end' }];

function graphToFlow(graph: WorkflowGraph | null): { nodes: Node[]; edges: Edge[] } {
  if (!graph?.nodes?.length) return { nodes: initialNodes, edges: initialEdges };
  const nodes: Node[] = graph.nodes.map((n) => ({
    id: n.id,
    type: (n.type as string) in nodeTypes ? (n.type as keyof NodeTypes) : 'plain',
    position: n.position,
    data: n.data ?? {},
    width: n.width,
    height: n.height,
  }));
  const edges: Edge[] = (graph.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }));
  return { nodes, edges };
}

function flowToGraph(nodes: Node[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (((n.type as string) || 'plain') as NodeType),
      position: n.position,
      data: n.data ?? {},
      width: n.width,
      height: n.height,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

interface WorkflowEditorProps {
  workflowId: string | null;
  initialGraph: WorkflowGraph | null;
  onSave: (graph: WorkflowGraph) => Promise<void>;
  onRun?: () => void;
  /** 外部触发保存时递增此值（如 TopNavBar 点击保存） */
  triggerSaveToken?: number;
  onSavingChange?: (v: boolean) => void;
}

export function WorkflowEditor({
  workflowId,
  initialGraph,
  onSave,
  triggerSaveToken = 0,
  onSavingChange,
}: WorkflowEditorProps) {
  const { nodes: initN, edges: initE } = graphToFlow(initialGraph);
  const [nodes, setNodes, onNodesChange] = useNodesState(initN);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initE);
  const [, setSavingInternal] = useState(false);
  const setSaving = useCallback(
    (v: boolean) => {
      setSavingInternal(v);
      onSavingChange?.(v);
    },
    [onSavingChange],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const handleSave = useCallback(async () => {
    if (!workflowId) return;
    setSaving(true);
    try {
      await onSave(flowToGraph(nodes, edges));
    } finally {
      setSaving(false);
    }
  }, [workflowId, nodes, edges, onSave]);

  useEffect(() => {
    if (triggerSaveToken > 0) handleSave();
    // 仅随外部触发 token 变化时保存，不随 handleSave 引用变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSaveToken]);

  const addNode = useCallback(
    (type: 'start' | 'end' | 'plain' | 'ai' | 'input' | 'output' | 'http' | 'condition_if' | 'condition_switch') => {
      const id = `${type}-${Date.now()}`;
      const y = nodes.length * 120;
      const defaultData: Record<string, unknown> =
        type === 'plain'
          ? { label: '处理节点' }
            : type === 'ai'
              ? {
                  label: 'AI 节点',
                  provider: 'bailian',
                  model: 'qwen3.5-plus',
                  systemPrompt: '',
                  inputMapping: { user: '{{inputs.message}}' },
                }
            : type === 'input'
              ? {
                  label: '输入',
                  assignments: { message: '{{inputs.message}}' },
                }
              : type === 'output'
                ? {
                    label: '输出',
                    outputMapping: { result: '{{inputs.message}}' },
                  }
            : type === 'http'
              ? {
                  label: 'HTTP',
                  method: 'GET',
                  url: 'https://api.example.com',
                  headers: {},
                  body: '',
                }
            : type === 'condition_if'
              ? {
                  label: '条件分支',
                  expression: '{{inputs.score}} > 60',
                  trueOutput: 'true',
                  falseOutput: 'false',
                }
            : type === 'condition_switch'
              ? {
                  label: '多分支',
                  variable: '{{inputs.type}}',
                  cases: [
                    { value: 'a', outputKey: 'a' },
                    { value: 'b', outputKey: 'b' },
                  ],
                  defaultOutput: '__default__',
                }
            : {};
      setNodes((nds) =>
        nds.concat({
          id,
          type,
          position: { x: 250 + (Math.random() - 0.5) * 200, y },
          data: defaultData,
        }),
      );
    },
    [nodes.length, setNodes],
  );

  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
    );
  }, [setNodes]);

  return (
    <div className="flex h-full flex-col">
      {/* 画布上方：仅添加节点工具栏（运行/保存已移至顶部导航栏） */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2 shadow-sm">
        <span className="mr-2 text-xs font-semibold text-muted-foreground">添加节点</span>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('start')}>
          <Play className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">开始</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('plain')}>
          <Box className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">节点</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('input')}>
          <ArrowDownToLine className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">输入</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('ai')}>
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('output')}>
          <ArrowUpFromLine className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">输出</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('http')}>
          <Globe className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">HTTP</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('condition_if')}>
          <GitBranch className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">条件</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('condition_switch')}>
          <GitCompare className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">多分支</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => addNode('end')}>
          <Square className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">结束</span>
        </Button>
      </div>
      <div className="relative flex flex-1 min-h-0">
        <div className="relative flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange as OnNodesChange}
            onEdgesChange={onEdgesChange as OnEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#86909C" />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <AnimatePresence mode="wait">
        {selectedNode && (
          <motion.div
            key="config-panel"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
          <NodeConfigPanel
            node={selectedNode}
            nodes={nodes}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
