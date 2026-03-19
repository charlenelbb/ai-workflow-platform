/** 数据节点（输出）：绿色 #00B42A，圆角 8px，图标+名称 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowUpFromLine } from 'lucide-react';
import { nodeBase, nodeSubtext } from './node-styles';

function OutputNode({ data }: NodeProps) {
  const label = (data?.label as string) || '输出';
  return (
    <div className={`${nodeBase} bg-[#00B42A] text-white`}>
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <div className="flex items-center justify-center gap-1.5">
        <ArrowUpFromLine className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="font-semibold">{label}</span>
      </div>
      <div className={nodeSubtext}>变量 → outputs</div>
      <Handle type="source" position={Position.Bottom} id="out" className="!bottom-[-6px]" />
    </div>
  );
}

export default memo(OutputNode);
