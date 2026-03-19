import type React from 'react';

/**
 * 画布节点统一样式：8px 圆角、轻微阴影、hover 上浮
 * 与设计规范一致
 */
export const nodeBase =
  'relative min-w-[100px] rounded-lg px-3 py-3 text-center font-medium text-sm transition-all duration-200 ease-out ' +
  'shadow-[0_1px_3px_rgba(0,0,0,0.06)] ' +
  'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ' +
  'hover:-translate-y-0.5';

/** 开始/结束节点：圆角 12px，内边距 16px */
export const nodeStartEnd =
  'relative min-w-[100px] rounded-[12px] px-4 py-4 flex flex-col items-center justify-center gap-1.5 ' +
  'text-white font-semibold text-sm transition-all duration-200 ease-out ' +
  'shadow-[0_1px_3px_rgba(0,0,0,0.08)] ' +
  'hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] ' +
  'hover:-translate-y-0.5';

/** 普通/业务节点：圆角 8px，内边距 12px */
export const nodeSubtext = 'mt-0.5 text-[11px] opacity-90';

/** 节点执行状态：用于 data.executionStatus，与 run 的 nodeLogs 对应 */
export type NodeExecutionStatus = 'none' | 'success' | 'failed' | 'running';

/** 根据执行状态返回节点外圈 className（border 保证可见） */
export function getExecutionStatusClass(status: NodeExecutionStatus | undefined): string {
  if (!status || status === 'none') return '';
  switch (status) {
    case 'success':
      return 'border-2 border-green-500';
    case 'failed':
      return 'border-2 border-red-500';
    case 'running':
      return 'border-2 border-amber-500 animate-pulse';
    default:
      return '';
  }
}

/** 根据执行状态返回节点外圈 style（兜底，确保样式一定生效） */
export function getExecutionStatusStyle(status: NodeExecutionStatus | undefined): React.CSSProperties {
  if (!status || status === 'none') return {};
  switch (status) {
    case 'success':
      return { boxShadow: '0 0 0 2px rgb(34 197 94)' };
    case 'failed':
      return { boxShadow: '0 0 0 2px rgb(239 68 68)' };
    case 'running':
      return { boxShadow: '0 0 0 2px rgb(245 158 11)' };
    default:
      return {};
  }
}

/** 节点右上角状态角标（成功✓ / 失败✗ / 执行中），用内联样式保证可见 */
export function ExecutionStatusBadge({ status }: { status: NodeExecutionStatus | undefined }) {
  if (!status || status === 'none') return null;
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    zIndex: 10,
  };
  if (status === 'success') return <span style={{ ...baseStyle, backgroundColor: '#22c55e' }} title="已成功">✓</span>;
  if (status === 'failed') return <span style={{ ...baseStyle, backgroundColor: '#ef4444' }} title="执行失败">✗</span>;
  if (status === 'running') return <span style={{ ...baseStyle, backgroundColor: '#f59e0b' }} title="执行中">⋯</span>;
  return null;
}
