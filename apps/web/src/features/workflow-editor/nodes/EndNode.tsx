/** 结束节点：危险色 #F53F3F 背景，停止图标，文字「结束」在图标下方 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Square } from 'lucide-react';
import { nodeStartEnd } from './node-styles';

function EndNode(_: NodeProps) {
  return (
    <div
      className={`${nodeStartEnd} bg-[#F53F3F] min-w-[100px]`}
    >
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <Square className="h-5 w-5 fill-current" strokeWidth={2} />
      <span>结束</span>
    </div>
  );
}

export default memo(EndNode);
