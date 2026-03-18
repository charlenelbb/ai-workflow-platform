import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function ConditionIfNode({ data }: NodeProps) {
  const label = (data?.label as string) || '条件分支';
  const expression = (data?.expression as string) || '';
  const displayExpr = expression ? (expression.length > 20 ? expression.slice(0, 20) + '…' : expression) : '未配置';
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#fff',
        fontWeight: 500,
        minWidth: 140,
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div>{label}</div>
      <div style={{ fontSize: 10, opacity: 0.9, marginTop: 4 }}>{displayExpr}</div>
      <div style={{ position: 'relative', marginTop: 8, minHeight: 20 }}>
        <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%', transform: 'translateX(-50%)' }} />
        <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%', transform: 'translateX(-50%)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 2, paddingLeft: 8,
        paddingRight: 8, }}>
        <span style={{ marginLeft: '15%' }}>是</span>
        <span style={{ marginRight: '15%' }}>否</span>
      </div>
    </div>
  );
}

export default memo(ConditionIfNode);
