import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function EndNode(_: NodeProps) {
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: '#fff',
        fontWeight: 600,
        minWidth: 100,
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <span>结束</span>
    </div>
  );
}

export default memo(EndNode);
