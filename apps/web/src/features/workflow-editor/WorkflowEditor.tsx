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
import type { WorkflowGraph } from '@/types/workflow';

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
      type: (n.type as string) || 'plain',
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
    (type: 'start' | 'end' | 'plain' | 'ai') => {
      const id = `${type}-${Date.now()}`;
      const y = nodes.length * 120;
      const defaultData: Record<string, unknown> =
        type === 'plain'
          ? { label: '处理节点' }
          : type === 'ai'
            ? {
                label: 'AI 节点',
                provider: 'openai',
                model: 'gpt-3.5-turbo',
                systemPrompt: '',
                inputMapping: { user: '{{start}}' },
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontWeight: 600 }}>工作流编辑器</span>
        <button
          type="button"
          onClick={() => addNode('start')}
          style={{ padding: '6px 12px', cursor: 'pointer' }}
        >
          添加开始
        </button>
        <button
          type="button"
          onClick={() => addNode('plain')}
          style={{ padding: '6px 12px', cursor: 'pointer' }}
        >
          添加节点
        </button>
        <button
          type="button"
          onClick={() => addNode('ai')}
          style={{ padding: '6px 12px', cursor: 'pointer' }}
        >
          添加 AI 节点
        </button>
        <button
          type="button"
          onClick={() => addNode('end')}
          style={{ padding: '6px 12px', cursor: 'pointer' }}
        >
          添加结束
        </button>
        {workflowId && (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '6px 12px', cursor: saving ? 'wait' : 'pointer' }}
            >
              {saving ? '保存中…' : '保存'}
            </button>
            {onRun && (
              <button
                type="button"
                onClick={async () => {
                  setRunning(true);
                  try {
                    await onRun();
                  } finally {
                    setRunning(false);
                  }
                }}
                disabled={running}
                style={{ padding: '6px 12px', cursor: running ? 'wait' : 'pointer' }}
              >
                {running ? '运行中…' : '运行'}
              </button>
            )}
          </>
        )}
      </header>
      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ flex: 1 }}>
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
            onUpdate={updateNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
