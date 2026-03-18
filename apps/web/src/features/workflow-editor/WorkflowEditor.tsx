import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
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
}

export function WorkflowEditor({
  workflowId,
  initialGraph,
  onSave,
  onRun,
}: WorkflowEditorProps) {
  const { nodes: initN, edges: initE } = graphToFlow(initialGraph);
  const [nodes, setNodes, onNodesChange] = useNodesState(initN);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initE);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
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
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="font-semibold">工作流编辑器</span>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('start')}>
          添加开始
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('plain')}>
          添加节点
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('input')}>
          添加输入
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('ai')}>
          添加 AI 节点
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('output')}>
          添加输出
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('http')}>
          HTTP
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('condition_if')}>
          条件分支
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('condition_switch')}>
          多分支
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addNode('end')}>
          添加结束
        </Button>
        {workflowId && (
          <>
            <Button type="button" variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
            {onRun && (
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  setRunning(true);
                  try {
                    await onRun();
                  } finally {
                    setRunning(false);
                  }
                }}
                disabled={running}
              >
                {running ? '运行中…' : '运行'}
              </Button>
            )}
          </>
        )}
      </header>
      <div className="flex flex-1">
        <div className="flex-1">
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
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            nodes={nodes}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
