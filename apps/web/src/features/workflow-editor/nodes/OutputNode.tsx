import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function OutputNode({ data }: NodeProps) {
  const label = (data?.label as string) || '输出';
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: '#10b981',
        color: '#fff',
        fontWeight: 600,
        minWidth: 120,
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>变量 → outputs</div>
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}

export default memo(OutputNode);

