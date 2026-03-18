import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function ConditionSwitchNode({ data }: NodeProps) {
  const label = (data?.label as string) || '多分支';
  const cases = (data?.cases as Array<{ value: string; outputKey: string }>) || [];
  const defaultKey = (data?.defaultOutput as string) || '__default__';
  const variable = (data?.variable as string) || '';
  const displayVar = variable ? (variable.length > 16 ? variable.slice(0, 16) + '…' : variable) : '未配置';
  const caseOutputs = cases.map((c) => c.outputKey).filter(Boolean);
  const outputs = caseOutputs.length > 0 ? [...new Set([...caseOutputs, defaultKey])] : [defaultKey];
  const n = Math.max(outputs.length, 1);
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        color: '#fff',
        fontWeight: 500,
        minWidth: 140,
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div>{label}</div>
      <div style={{ fontSize: 10, opacity: 0.9, marginTop: 4 }}>{displayVar}</div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginTop: 8,
          position: 'relative',
          minHeight: 24,
        }}
      >
        {outputs.map((out, i) => (
          <Handle
            key={out}
            type="source"
            position={Position.Bottom}
            id={out}
            style={{
              left: `${((i + 0.5) / n) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>
        {outputs.length} 分支
      </div>
    </div>
  );
}

export default memo(ConditionSwitchNode);
