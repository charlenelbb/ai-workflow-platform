/**
 * 工作流节点类型与数据结构
 */

export type NodeType =
  | 'trigger'
  | 'ai'
  | 'http'
  | 'database'
  | 'condition_if'
  | 'condition_switch'
  | 'code'
  | 'aggregate'
  | 'start'
  | 'end'
  | 'plain';

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  data: Record<string, unknown>;
  width?: number;
  height?: number;
}

/** AI 节点配置 */
export interface AINodeData {
  provider: 'openai' | 'bailian' | 'local';
  model: string;
  systemPrompt?: string;
  inputMapping: Record<string, string>;
}

/** HTTP 工具节点配置 */
export interface HttpNodeData {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

/** 条件 If 节点配置 */
export interface ConditionIfData {
  expression: string;
  trueOutput?: string;
  falseOutput?: string;
}

/** 条件 Switch 节点配置 */
export interface ConditionSwitchData {
  variable: string;
  cases: Array<{ value: string; outputKey: string }>;
  defaultOutput?: string;
}
