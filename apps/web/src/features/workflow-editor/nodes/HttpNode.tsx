import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { nodeBase, nodeSubtext } from './node-styles';

function HttpNode({ data }: NodeProps) {
  const label = (data?.label as string) || 'HTTP';
  const method = (data?.method as string) || 'GET';
  const url = (data?.url as string) || '';
  const displayUrl = url ? (url.length > 24 ? url.slice(0, 24) + '…' : url) : '未配置';
  return (
    <div className={`${nodeBase} bg-[#165DFF] text-white`}>
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <div className="flex items-center justify-center gap-1.5">
        <Globe className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>{label}</span>
      </div>
      <div className={nodeSubtext}>{method} {displayUrl}</div>
      <Handle type="source" position={Position.Bottom} id="out" className="!bottom-[-6px]" />
    </div>
  );
}

export default memo(HttpNode);
