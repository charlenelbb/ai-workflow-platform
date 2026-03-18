import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function AINode({ data }: NodeProps) {
  const label = (data?.label as string) || 'AI 节点';
  const model = (data?.model as string) || '';
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
        color: '#fff',
        fontWeight: 500,
        minWidth: 120,
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div>{label}</div>
      {model && (
        <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>{model}</div>
      )}
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}

export default memo(AINode);
