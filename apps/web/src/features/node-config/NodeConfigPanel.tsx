import { useCallback, useState } from 'react';
import type { Node } from '@xyflow/react';

export interface AINodeData {
  provider?: 'openai' | 'bailian' | 'local';
  model?: string;
  systemPrompt?: string;
  inputMapping?: Record<string, string>;
  label?: string;
}

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const data = (node?.data ?? {}) as AINodeData;
  const [model, setModel] = useState(data.model ?? 'gpt-3.5-turbo');
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt ?? '');
  const [userMapping, setUserMapping] = useState(
    data.inputMapping?.user ?? data.inputMapping?.content ?? '{{start}}',
  );
  const [label, setLabel] = useState(data.label ?? 'AI 节点');

  const handleApply = useCallback(() => {
    if (!node) return;
    onUpdate(node.id, {
      ...node.data,
      label,
      model,
      systemPrompt,
      inputMapping: { user: userMapping },
    });
    onClose();
  }, [node, label, model, systemPrompt, userMapping, onUpdate, onClose]);

  if (!node) return null;
  if (node.type !== 'ai') {
    return (
      <div
        style={{
          width: 280,
          padding: 16,
          borderLeft: '1px solid #e2e8f0',
          background: '#f8fafc',
          fontSize: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>节点配置</strong>
          <button type="button" onClick={onClose} style={{ cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ color: '#64748b' }}>该节点类型暂无配置项</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 280,
        padding: 16,
        borderLeft: '1px solid #e2e8f0',
        background: '#f8fafc',
        fontSize: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>AI 节点配置</strong>
        <button type="button" onClick={onClose} style={{ cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>显示名称</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>模型</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gpt-3.5-turbo"
          style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>System Prompt（可选）</span>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="你是一个助手..."
          rows={3}
          style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4, resize: 'vertical' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>用户输入映射</span>
        <input
          value={userMapping}
          onChange={(e) => setUserMapping(e.target.value)}
          placeholder="{{start}} 或 {{start.message}}"
          style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
        />
        <span style={{ fontSize: 12, color: '#64748b' }}>
          使用 {'{{节点ID}}'} 或 {'{{节点ID.字段}}'} 引用上游输出
        </span>
      </label>
      <button
        type="button"
        onClick={handleApply}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 500,
        }}
      >
        应用
      </button>
    </div>
  );
}
