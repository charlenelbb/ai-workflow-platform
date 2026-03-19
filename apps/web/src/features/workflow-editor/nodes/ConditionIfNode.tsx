import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { nodeBase, nodeSubtext } from './node-styles';

function ConditionIfNode({ data }: NodeProps) {
  const label = (data?.label as string) || '条件分支';
  const expression = (data?.expression as string) || '';
  const displayExpr = expression ? (expression.length > 20 ? expression.slice(0, 20) + '…' : expression) : '未配置';
  return (
    <div className={`${nodeBase} min-w-[140px] bg-[#F7BA1E] text-white`}>
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <div className="flex items-center justify-center gap-1.5">
        <GitBranch className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>{label}</span>
      </div>
      <div className={nodeSubtext}>{displayExpr}</div>
      <div className="relative mt-2 min-h-5">
        <Handle type="source" position={Position.Bottom} id="true" className="!left-[30%] !-translate-x-1/2 !bottom-[-6px]" />
        <Handle type="source" position={Position.Bottom} id="false" className="!left-[70%] !-translate-x-1/2 !bottom-[-6px]" />
      </div>
      <div className="mt-0.5 flex justify-between px-2 text-[10px] opacity-90">
        <span className="ml-[18%]">是</span>
        <span className="mr-[18%]">否</span>
      </div>
    </div>
  );
}

export default memo(ConditionIfNode);
