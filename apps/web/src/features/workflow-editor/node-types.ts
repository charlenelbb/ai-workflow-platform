import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';
import PlainNode from './nodes/PlainNode';
import AINode from './nodes/AINode';
import InputNode from './nodes/InputNode';
import OutputNode from './nodes/OutputNode';
import HttpNode from './nodes/HttpNode';
import ConditionIfNode from './nodes/ConditionIfNode';
import ConditionSwitchNode from './nodes/ConditionSwitchNode';

export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  plain: PlainNode,
  ai: AINode,
  input: InputNode,
  output: OutputNode,
  http: HttpNode,
  condition_if: ConditionIfNode,
  condition_switch: ConditionSwitchNode,
};
