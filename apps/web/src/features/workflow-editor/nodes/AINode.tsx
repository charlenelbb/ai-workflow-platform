/** AI 节点：紫色 #722ED1，圆角 8px，内边距 12px，图标+名称；支持执行状态环与角标 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { nodeBase, nodeSubtext, getExecutionStatusClass, getExecutionStatusStyle, ExecutionStatusBadge } from './node-styles';
import type { NodeExecutionStatus } from './node-styles';

function AINode({ data }: NodeProps) {
  const label = (data?.label as string) || 'AI 节点';
  const model = (data?.model as string) || '';
  const status = (data?.executionStatus as NodeExecutionStatus) ?? 'none';
  return (
    <div className={`${nodeBase} bg-[#722ED1] text-white ${getExecutionStatusClass(status)}`} style={getExecutionStatusStyle(status)}>
      <ExecutionStatusBadge status={status} />
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <div className="flex items-center justify-center gap-1.5">
        <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>{label}</span>
      </div>
      {model && <div className={nodeSubtext}>{model}</div>}
      <Handle type="source" position={Position.Bottom} id="out" className="!bottom-[-6px]" />
    </div>
  );
}

export default memo(AINode);
