/**
 * 工作流节点类型与数据结构
 */

export type NodeType =
  | 'trigger'
  | 'input'
  | 'ai'
  | 'http'
  | 'database'
  | 'condition_if'
  | 'condition_switch'
  | 'code'
  | 'aggregate'
  | 'output'
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

/** 输入节点：从 run.inputs 读取并写入变量上下文 */
export interface InputNodeData {
  /** 变量赋值：key -> 模板或常量；支持 {{inputs.xxx}} / {{上游节点ID.xxx}} */
  assignments: Record<string, unknown>;
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

/** 输出节点：从上下文中取值作为最终 outputs */
export interface OutputNodeData {
  /** 输出映射：outputKey -> 模板或常量 */
  outputMapping: Record<string, unknown>;
}
