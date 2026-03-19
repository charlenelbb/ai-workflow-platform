/** 数据节点（输入）：绿色 #00B42A，圆角 8px，图标+名称；支持执行状态环与角标 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowDownToLine } from 'lucide-react';
import { nodeBase, nodeSubtext, getExecutionStatusClass, getExecutionStatusStyle, ExecutionStatusBadge } from './node-styles';
import type { NodeExecutionStatus } from './node-styles';

function InputNode({ data }: NodeProps) {
  const label = (data?.label as string) || '输入';
  const status = (data?.executionStatus as NodeExecutionStatus) ?? 'none';
  return (
    <div className={`${nodeBase} bg-[#00B42A] text-white ${getExecutionStatusClass(status)}`} style={getExecutionStatusStyle(status)}>
      <ExecutionStatusBadge status={status} />
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <div className="flex items-center justify-center gap-1.5">
        <ArrowDownToLine className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="font-semibold">{label}</span>
      </div>
      <div className={nodeSubtext}>inputs → 变量</div>
      <Handle type="source" position={Position.Bottom} id="out" className="!bottom-[-6px]" />
    </div>
  );
}

export default memo(InputNode);
