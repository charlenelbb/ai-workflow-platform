import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function StartNode(_: NodeProps) {
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        fontWeight: 600,
        minWidth: 100,
        textAlign: 'center',
      }}
    >
      <span>开始</span>
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  );
}

export default memo(StartNode);
