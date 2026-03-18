import { useCallback, useMemo, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface AINodeData {
  provider?: 'openai' | 'bailian' | 'local';
  model?: string;
  systemPrompt?: string;
  inputMapping?: Record<string, string>;
  label?: string;
}

export interface InputNodeData {
  label?: string;
  assignments?: Record<string, unknown>;
}

export interface OutputNodeData {
  label?: string;
  outputMapping?: Record<string, unknown>;
}

/** 全局变量项：所有节点的输入/输出，供插入到当前 input */
export interface GlobalVariableOption {
  label: string;
  value: string;
}

function buildGlobalVariableList(nodes: Node[], currentNodeId: string): GlobalVariableOption[] {
  const list: GlobalVariableOption[] = [
    { label: '运行输入 (整体)', value: '{{inputs}}' },
    { label: '运行输入.message', value: '{{inputs.message}}' },
  ];
  nodes.forEach((n) => {
    if (n.id === currentNodeId) return;
    const type = (n.type as string) || '';
    list.push({ label: `${n.id} (整体)`, value: `{{${n.id}}}` });
    if (type === 'ai') {
      list.push({ label: `${n.id}.text`, value: `{{${n.id}.text}}` });
      list.push({ label: `${n.id}.content`, value: `{{${n.id}.content}}` });
    }
  });
  return list;
}

function InsertVariableDropdown({
  variableList,
  inputRef,
  value,
  setValue,
  savedSelectionRef,
  placeholder = '插入变量',
}: {
  variableList: GlobalVariableOption[];
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  /** 由父组件在对应 input 的 onBlur 里写入选区，选择变量时用此插入 */
  savedSelectionRef: React.MutableRefObject<{ start: number; end: number } | null>;
  placeholder?: string;
}) {
  const handledRef = useRef(false);

  const handleSelect = useCallback(
    (opt: GlobalVariableOption) => {
      const el = inputRef.current;
      const saved = savedSelectionRef.current;
      setValue((prev) => {
        const currentValue = typeof prev === 'string' ? prev : '';
        const start = saved ? Math.min(saved.start, currentValue.length) : currentValue.length;
        const end = saved ? Math.min(saved.end, currentValue.length) : currentValue.length;
        return currentValue.slice(0, start) + opt.value + currentValue.slice(end);
      });
      savedSelectionRef.current = null;
      requestAnimationFrame(() => {
        if (el && 'setSelectionRange' in el) {
          // 重新聚焦并把光标放到插入内容后
          const posBase = saved ? saved.start : (typeof value === 'string' ? value.length : 0);
          el.focus();
          el.setSelectionRange(posBase + opt.value.length, posBase + opt.value.length);
        }
      });
    },
    [inputRef, setValue, savedSelectionRef, value],
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button type="button" variant="outline" size="sm">
          {placeholder}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[220px] min-w-[200px] overflow-y-auto">
        {variableList.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onMouseDown={(e) => {
              // 防止输入框先失焦导致选区被改写
              e.preventDefault();
            }}
            onSelect={() => {
              if (handledRef.current) return;
              handledRef.current = true;
              handleSelect(opt);
              requestAnimationFrame(() => {
                handledRef.current = false;
              });
            }}
            onClick={() => {
              // 兜底：部分情况下 onSelect 不触发
              if (handledRef.current) return;
              handledRef.current = true;
              handleSelect(opt);
              requestAnimationFrame(() => {
                handledRef.current = false;
              });
            }}
            className="flex flex-col items-start gap-0.5"
          >
            <code className="text-xs">{opt.value}</code>
            <span className="text-xs text-muted-foreground">{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NodeConfigPanelProps {
  node: Node | null;
  nodes: Node[];
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, nodes, onUpdate, onClose }: NodeConfigPanelProps) {
  const baseData = (node?.data ?? {}) as Record<string, unknown>;
  const [label, setLabel] = useState((baseData.label as string) ?? '');

  // ai
  const aiData = baseData as AINodeData;
  const [model, setModel] = useState(
    aiData.model ?? (aiData.provider === 'bailian' ? 'qwen3.5-plus' : 'gpt-3.5-turbo'),
  );
  const [systemPrompt, setSystemPrompt] = useState(aiData.systemPrompt ?? '');
  const [userMapping, setUserMapping] = useState(
    aiData.inputMapping?.user ?? aiData.inputMapping?.content ?? '{{inputs.message}}',
  );

  // input
  const inputData = baseData as InputNodeData;
  const [assignmentsText, setAssignmentsText] = useState(
    JSON.stringify(inputData.assignments ?? { message: '{{inputs.message}}' }, null, 2),
  );

  // output
  const outputData = baseData as OutputNodeData;
  const [outputMappingText, setOutputMappingText] = useState(
    JSON.stringify(outputData.outputMapping ?? { result: '{{inputs.message}}' }, null, 2),
  );

  const refUserMapping = useRef<HTMLInputElement>(null);
  const refAssignments = useRef<HTMLTextAreaElement>(null);
  const refOutputMapping = useRef<HTMLTextAreaElement>(null);
  const savedUserMappingSelection = useRef<{ start: number; end: number } | null>(null);
  const savedAssignmentsSelection = useRef<{ start: number; end: number } | null>(null);
  const savedOutputMappingSelection = useRef<{ start: number; end: number } | null>(null);

  const captureSelection = useCallback(
    (
      ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
      savedRef: React.MutableRefObject<{ start: number; end: number } | null>,
    ) => {
      const el = ref.current;
      if (el && 'selectionStart' in el) {
        savedRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
      }
    },
    [],
  );

  const variableList = useMemo(
    () => (node && nodes.length ? buildGlobalVariableList(nodes, node.id) : []),
    [node, nodes],
  );

  const handleApply = useCallback(() => {
    if (!node) return;
    if (node.type === 'ai') {
      onUpdate(node.id, {
        ...node.data,
        label: label || 'AI 节点',
        model,
        systemPrompt,
        inputMapping: { user: userMapping },
      });
    } else if (node.type === 'input') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(assignmentsText || '{}');
      } catch (e) {
        alert(`assignments 必须是 JSON 对象: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        alert('assignments 必须是 JSON 对象，例如：{"foo":"{{inputs.message}}"}');
        return;
      }
      onUpdate(node.id, {
        ...node.data,
        label: label || '输入',
        assignments: parsed as Record<string, unknown>,
      });
    } else if (node.type === 'output') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(outputMappingText || '{}');
      } catch (e) {
        alert(`outputMapping 必须是 JSON 对象: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        alert('outputMapping 必须是 JSON 对象，例如：{"result":"{{ai.text}}"}');
        return;
      }
      onUpdate(node.id, {
        ...node.data,
        label: label || '输出',
        outputMapping: parsed as Record<string, unknown>,
      });
    } else {
      onUpdate(node.id, { ...node.data, label });
    }
    onClose();
  }, [
    node,
    label,
    model,
    systemPrompt,
    userMapping,
    assignmentsText,
    outputMappingText,
    onUpdate,
    onClose,
  ]);

  if (!node) return null;
  if (node.type !== 'ai' && node.type !== 'input' && node.type !== 'output') {
    return (
      <div className="w-[280px] border-l border-border bg-muted/30 p-4 text-sm">
        <div className="mb-3 flex items-center justify-between">
          <strong>节点配置</strong>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭">
            ×
          </Button>
        </div>
        <p className="text-muted-foreground">该节点类型暂无配置项</p>
      </div>
    );
  }

  const inputClassName =
    'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';
  const textareaClassName =
    'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm font-mono text-xs resize-y';

  return (
    <div className="flex w-[280px] flex-col gap-3 border-l border-border bg-muted/30 p-4 text-sm">
      <div className="flex items-center justify-between">
        <strong>
          {node.type === 'ai' ? 'AI 节点配置' : node.type === 'input' ? '输入节点配置' : '输出节点配置'}
        </strong>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭">
          ×
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>显示名称</Label>
        <Input value={label || ''} onChange={(e) => setLabel(e.target.value)} className={inputClassName} />
      </div>
      {node.type === 'ai' && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>模型</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-3.5-turbo" className={inputClassName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>System Prompt（可选）</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="你是一个助手..."
              rows={3}
              className={textareaClassName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label className="mb-0">用户输入映射</Label>
              <InsertVariableDropdown
                variableList={variableList}
                inputRef={refUserMapping}
                value={userMapping}
                setValue={setUserMapping}
                savedSelectionRef={savedUserMappingSelection}
                placeholder="插入全局变量"
              />
            </div>
            <input
              ref={refUserMapping}
              value={userMapping}
              onChange={(e) => setUserMapping(e.target.value)}
              onSelect={() => captureSelection(refUserMapping, savedUserMappingSelection)}
              onKeyUp={() => captureSelection(refUserMapping, savedUserMappingSelection)}
              onMouseUp={() => captureSelection(refUserMapping, savedUserMappingSelection)}
              placeholder="{{inputs.message}} 或 {{某节点ID.text}}"
              className={inputClassName}
            />
            <span className="text-xs text-muted-foreground">
              支持 {'{{inputs.xxx}}'}、{'{{节点ID}}'}、{'{{节点ID.字段}}'}
            </span>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
            <strong>传给下游：</strong>使用 <code>{`{{${node.id}.text}}`}</code> 或 <code>{`{{${node.id}.content}}`}</code>（本节点 ID：<code>{node.id}</code>）
          </div>
        </>
      )}

      {node.type === 'input' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Label className="mb-0">变量赋值（JSON 对象）</Label>
            <InsertVariableDropdown
              variableList={variableList}
              inputRef={refAssignments}
              value={assignmentsText}
              setValue={setAssignmentsText}
              savedSelectionRef={savedAssignmentsSelection}
              placeholder="插入全局变量"
            />
          </div>
          <textarea
            ref={refAssignments}
            value={assignmentsText}
            onChange={(e) => setAssignmentsText(e.target.value)}
            onSelect={() => captureSelection(refAssignments, savedAssignmentsSelection)}
            onKeyUp={() => captureSelection(refAssignments, savedAssignmentsSelection)}
            onMouseUp={() => captureSelection(refAssignments, savedAssignmentsSelection)}
            rows={8}
            className={textareaClassName}
          />
          <span className="text-xs text-muted-foreground">
            例：{'{"message":"{{inputs.message}}","foo":123}'}
          </span>
        </div>
      )}

      {node.type === 'output' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Label className="mb-0">输出映射（JSON 对象）</Label>
            <InsertVariableDropdown
              variableList={variableList}
              inputRef={refOutputMapping}
              value={outputMappingText}
              setValue={setOutputMappingText}
              savedSelectionRef={savedOutputMappingSelection}
              placeholder="插入全局变量"
            />
          </div>
          <textarea
            ref={refOutputMapping}
            value={outputMappingText}
            onChange={(e) => setOutputMappingText(e.target.value)}
            onSelect={() => captureSelection(refOutputMapping, savedOutputMappingSelection)}
            onKeyUp={() => captureSelection(refOutputMapping, savedOutputMappingSelection)}
            onMouseUp={() => captureSelection(refOutputMapping, savedOutputMappingSelection)}
            rows={8}
            className={textareaClassName}
          />
          <span className="text-xs text-muted-foreground">
            例：{'{"result":"{{AI节点ID.text}}","raw":"{{inputs.message}}"}'} — AI 节点输出用 {'{{节点ID.text}}'} 或 {'{{节点ID.content}}'}
          </span>
        </div>
      )}
      <Button type="button" onClick={handleApply}>
        应用
      </Button>
    </div>
  );
}
