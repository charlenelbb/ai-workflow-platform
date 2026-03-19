import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { nodeBase } from './node-styles';

function PlainNode({ data }: NodeProps) {
  const label = (data?.label as string) || '处理节点';
  return (
    <div
      className={`${nodeBase} bg-card border border-border text-foreground hover:border-[var(--primary)]/30 hover:bg-[var(--muted)]/50`}
    >
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <span>{label}</span>
      <Handle type="source" position={Position.Bottom} id="out" className="!bottom-[-6px]" />
    </div>
  );
}

export default memo(PlainNode);
