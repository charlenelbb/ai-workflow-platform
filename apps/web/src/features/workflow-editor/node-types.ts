import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';
import PlainNode from './nodes/PlainNode';
import AINode from './nodes/AINode';
import InputNode from './nodes/InputNode';
import OutputNode from './nodes/OutputNode';

export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  plain: PlainNode,
  ai: AINode,
  input: InputNode,
  output: OutputNode,
};
