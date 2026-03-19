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
