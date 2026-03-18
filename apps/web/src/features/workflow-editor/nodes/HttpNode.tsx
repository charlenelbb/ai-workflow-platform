import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function HttpNode({ data }: NodeProps) {
  const label = (data?.label as string) || 'HTTP';
  const method = (data?.method as string) || 'GET';
  const url = (data?.url as string) || '';
  const displayUrl = url ? (url.length > 24 ? url.slice(0, 24) + '…' : url) : '未配置';
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
        color: '#fff',
        fontWeight: 500,
        minWidth: 120,
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
        {method} {displayUrl}
      </div>
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}

export default memo(HttpNode);
