import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitCompare } from 'lucide-react';
import { nodeBase, nodeSubtext, getExecutionStatusClass, getExecutionStatusStyle, ExecutionStatusBadge } from './node-styles';
import type { NodeExecutionStatus } from './node-styles';

function ConditionSwitchNode({ data }: NodeProps) {
  const label = (data?.label as string) || '多分支';
  const cases = (data?.cases as Array<{ value: string; outputKey: string }>) || [];
  const defaultKey = (data?.defaultOutput as string) || '__default__';
  const variable = (data?.variable as string) || '';
  const displayVar = variable ? (variable.length > 16 ? variable.slice(0, 16) + '…' : variable) : '未配置';
  const caseOutputs = cases.map((c) => c.outputKey).filter(Boolean);
  const outputs = caseOutputs.length > 0 ? [...new Set([...caseOutputs, defaultKey])] : [defaultKey];
  const n = Math.max(outputs.length, 1);
  const status = (data?.executionStatus as NodeExecutionStatus) ?? 'none';
  return (
    <div className={`${nodeBase} min-w-[140px] bg-[#722ED1] text-white ${getExecutionStatusClass(status)}`} style={getExecutionStatusStyle(status)}>
      <ExecutionStatusBadge status={status} />
      <Handle type="target" position={Position.Top} id="in" className="!top-[-6px]" />
      <div className="flex items-center justify-center gap-1.5">
        <GitCompare className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>{label}</span>
      </div>
      <div className={nodeSubtext}>{displayVar}</div>
      <div className="relative mt-2 flex justify-around min-h-6">
        {outputs.map((out, i) => (
          <Handle
            key={out}
            type="source"
            position={Position.Bottom}
            id={out}
            className="!bottom-[-6px] !-translate-x-1/2"
            style={{ left: `${((i + 0.5) / n) * 100}%` }}
          />
        ))}
      </div>
      <div className={`${nodeSubtext} text-[10px]`}>{outputs.length} 分支</div>
    </div>
  );
}

export default memo(ConditionSwitchNode);
