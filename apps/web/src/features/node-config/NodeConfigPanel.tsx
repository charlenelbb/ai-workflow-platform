import { useCallback, useState } from 'react';
import type { Node } from '@xyflow/react';

export interface AINodeData {
  provider?: 'openai' | 'bailian' | 'local';
  model?: string;
  systemPrompt?: string;
  inputMapping?: Record<string, string>;
  label?: string;
}

export interface InputNodeData {
  label?: string;
  assignments?: Record<string, unknown>;
}

export interface OutputNodeData {
  label?: string;
  outputMapping?: Record<string, unknown>;
}

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const baseData = (node?.data ?? {}) as Record<string, unknown>;
  const [label, setLabel] = useState((baseData.label as string) ?? '');

  // ai
  const aiData = baseData as AINodeData;
  const [model, setModel] = useState(aiData.model ?? 'gpt-3.5-turbo');
  const [systemPrompt, setSystemPrompt] = useState(aiData.systemPrompt ?? '');
  const [userMapping, setUserMapping] = useState(
    aiData.inputMapping?.user ?? aiData.inputMapping?.content ?? '{{inputs.message}}',
  );

  // input
  const inputData = baseData as InputNodeData;
  const [assignmentsText, setAssignmentsText] = useState(
    JSON.stringify(inputData.assignments ?? { message: '{{inputs.message}}' }, null, 2),
  );

  // output
  const outputData = baseData as OutputNodeData;
  const [outputMappingText, setOutputMappingText] = useState(
    JSON.stringify(outputData.outputMapping ?? { result: '{{inputs.message}}' }, null, 2),
  );

  const handleApply = useCallback(() => {
    if (!node) return;
    if (node.type === 'ai') {
      onUpdate(node.id, {
        ...node.data,
        label: label || 'AI 节点',
        model,
        systemPrompt,
        inputMapping: { user: userMapping },
      });
    } else if (node.type === 'input') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(assignmentsText || '{}');
      } catch (e) {
        alert(`assignments 必须是 JSON 对象: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        alert('assignments 必须是 JSON 对象，例如：{"foo":"{{inputs.message}}"}');
        return;
      }
      onUpdate(node.id, {
        ...node.data,
        label: label || '输入',
        assignments: parsed as Record<string, unknown>,
      });
    } else if (node.type === 'output') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(outputMappingText || '{}');
      } catch (e) {
        alert(`outputMapping 必须是 JSON 对象: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        alert('outputMapping 必须是 JSON 对象，例如：{"result":"{{ai.text}}"}');
        return;
      }
      onUpdate(node.id, {
        ...node.data,
        label: label || '输出',
        outputMapping: parsed as Record<string, unknown>,
      });
    } else {
      onUpdate(node.id, { ...node.data, label });
    }
    onClose();
  }, [
    node,
    label,
    model,
    systemPrompt,
    userMapping,
    assignmentsText,
    outputMappingText,
    onUpdate,
    onClose,
  ]);

  if (!node) return null;
  if (node.type !== 'ai' && node.type !== 'input' && node.type !== 'output') {
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
        <strong>
          {node.type === 'ai' ? 'AI 节点配置' : node.type === 'input' ? '输入节点配置' : '输出节点配置'}
        </strong>
        <button type="button" onClick={onClose} style={{ cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>显示名称</span>
        <input
          value={label || ''}
          onChange={(e) => setLabel(e.target.value)}
          style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
        />
      </label>
      {node.type === 'ai' && (
        <>
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
              placeholder="{{inputs.message}} 或 {{某节点ID.text}}"
              style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
            />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              支持 {'{{inputs.xxx}}'}、{'{{节点ID}}'}、{'{{节点ID.字段}}'}
            </span>
          </label>
        </>
      )}

      {node.type === 'input' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>变量赋值（JSON 对象）</span>
          <textarea
            value={assignmentsText}
            onChange={(e) => setAssignmentsText(e.target.value)}
            rows={8}
            style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            例：{'{"message":"{{inputs.message}}","foo":123}'}
          </span>
        </label>
      )}

      {node.type === 'output' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>输出映射（JSON 对象）</span>
          <textarea
            value={outputMappingText}
            onChange={(e) => setOutputMappingText(e.target.value)}
            rows={8}
            style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 4, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            例：{'{"result":"{{某节点ID.text}}","raw":"{{inputs.message}}"}'}
          </span>
        </label>
      )}
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
