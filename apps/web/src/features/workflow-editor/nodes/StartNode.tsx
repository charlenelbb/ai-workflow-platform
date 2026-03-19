/** 开始节点：主色 #165DFF 背景，播放图标；支持执行状态环与角标 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { nodeStartEnd, getExecutionStatusClass, getExecutionStatusStyle, ExecutionStatusBadge } from './node-styles';
import type { NodeExecutionStatus } from './node-styles';

function StartNode({ data }: NodeProps) {
  const status = (data?.executionStatus as NodeExecutionStatus) ?? 'none';
  return (
    <div className={`${nodeStartEnd} bg-[#165DFF] min-w-[100px] ${getExecutionStatusClass(status)}`} style={getExecutionStatusStyle(status)}>
      <ExecutionStatusBadge status={status} />
      <Play className="h-5 w-5 fill-current" strokeWidth={2.5} />
      <span>开始</span>
      <Handle type="source" position={Position.Bottom} id="out" className="!bottom-[-6px]" />
    </div>
  );
}

export default memo(StartNode);
