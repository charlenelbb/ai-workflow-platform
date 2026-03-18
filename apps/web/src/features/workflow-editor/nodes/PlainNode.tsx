import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function PlainNode({ data }: NodeProps) {
  const label = (data?.label as string) || '处理节点';
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: '#e2e8f0',
        color: '#334155',
        fontWeight: 500,
        minWidth: 120,
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <span>{label}</span>
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}

export default memo(PlainNode);
