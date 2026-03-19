/** 开始节点：主色 #165DFF 背景，播放图标，文字「开始」在图标下方 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { nodeStartEnd } from './node-styles';

function StartNode(_: NodeProps) {
  return (
    <div
      className={`${nodeStartEnd} bg-[#165DFF] min-w-[100px]`}
    >
      <Play className="h-5 w-5 fill-current" strokeWidth={2.5} />
      <span>开始</span>
      <Handle type="source" position={Position.Bottom} id="out" className="!bottom-[-6px]" />
    </div>
  );
}

export default memo(StartNode);
