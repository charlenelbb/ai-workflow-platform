import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type KvRow = { id: string; key: string; value: string };

function objectToRows(obj: unknown): KvRow[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj as Record<string, unknown>).map(([k, v]) => ({
    id: `${k}-${Math.random().toString(16).slice(2)}`,
    key: k,
    value: typeof v === 'string' ? v : JSON.stringify(v),
  }));
}

function rowsToObject(rows: KvRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  rows.forEach((r) => {
    const k = r.key.trim();
    if (!k) return;
    const raw = r.value ?? '';
    const trimmed = raw.trim();
    if (trimmed === 'true') out[k] = true;
    else if (trimmed === 'false') out[k] = false;
    else if (trimmed === 'null') out[k] = null;
    else if (/^-?\d+(\.\d+)?$/.test(trimmed)) out[k] = Number(trimmed);
    else if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        out[k] = JSON.parse(trimmed);
      } catch {
        out[k] = raw;
      }
    } else {
      out[k] = raw;
    }
  });
  return out;
}

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

export interface GlobalVariableGroup {
  groupLabel: string;
  groupHint?: string;
  options: GlobalVariableOption[];
}

function nodeDisplayName(n: Node): string {
  const data = (n.data ?? {}) as Record<string, unknown>;
  const label = typeof data.label === 'string' && data.label.trim() ? data.label.trim() : '';
  if (label) return label;
  const type = (n.type as string) || 'node';
  if (type === 'ai') return 'AI 节点';
  if (type === 'input') return '输入节点';
  if (type === 'output') return '输出节点';
  if (type === 'http') return 'HTTP 节点';
  if (type === 'condition_if') return '条件分支';
  if (type === 'condition_switch') return '多分支';
  if (type === 'plain') return '处理节点';
  if (type === 'start') return '开始';
  if (type === 'end') return '结束';
  return type;
}

/** 从 currentNodeId 沿边反向 BFS，得到所有能到达该节点的上游节点 ID（仅能读这些节点的变量） */
function getUpstreamNodeIds(edges: Edge[], currentNodeId: string): Set<string> {
  const visited = new Set<string>();
  const queue = [currentNodeId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.target !== cur) continue;
      const src = e.source;
      if (!visited.has(src)) {
        visited.add(src);
        queue.push(src);
      }
    }
  }
  return visited;
}

function buildGlobalVariableGroups(
  nodes: Node[],
  edges: Edge[],
  currentNodeId: string,
): GlobalVariableGroup[] {
  const upstreamIds = getUpstreamNodeIds(edges, currentNodeId);
  const groups: GlobalVariableGroup[] = [];

  nodes.forEach((n) => {
    if (n.id === currentNodeId) return;
    if (!upstreamIds.has(n.id)) return; // 只展示上游节点变量，下游读不到
    const type = (n.type as string) || '';
    const name = nodeDisplayName(n);
    const hint = n.id;
    const data = (n.data ?? {}) as Record<string, unknown>;
    const options: GlobalVariableOption[] = [{ label: '整体', value: `{{${n.id}}}` }];
    // 输入节点：assignments 各字段列在「输入节点」分类下
    if (type === 'input') {
      const assignments = (data.assignments ?? {}) as Record<string, unknown>;
      Object.keys(assignments).filter(Boolean).forEach((key) => {
        options.push({ label: key, value: `{{${key}}}` });
      });
    }
    // 输出节点：outputMapping 各字段列在「输出节点」分类下
    if (type === 'output') {
      const outputMapping = (data.outputMapping ?? {}) as Record<string, unknown>;
      Object.keys(outputMapping).filter(Boolean).forEach((key) => {
        options.push({ label: key, value: `{{${key}}}` });
      });
    }
    if (type === 'ai') {
      options.push({ label: 'text', value: `{{${n.id}.text}}` });
      options.push({ label: 'content', value: `{{${n.id}.content}}` });
    }
    if (type === 'http') {
      options.push({ label: 'status', value: `{{${n.id}.status}}` });
      options.push({ label: 'data', value: `{{${n.id}.data}}` });
      options.push({ label: 'raw', value: `{{${n.id}.raw}}` });
    }
    groups.push({ groupLabel: name, groupHint: hint, options });
  });

  return groups;
}

function InsertVariableDropdown({
  variableGroups,
  inputRef,
  value,
  setValue,
  savedSelectionRef,
  placeholder = '插入变量',
}: {
  variableGroups: GlobalVariableGroup[];
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
      <DropdownMenuContent align="start" className="max-h-[320px] min-w-[280px] overflow-y-auto">
        {variableGroups.map((g, gi) => (
          <div key={`${g.groupLabel}-${gi}`}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between">
                <span className="truncate">{g.groupLabel}</span>
                {g.groupHint && (
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {g.groupHint}
                  </span>
                )}
              </DropdownMenuLabel>
              {g.options.map((opt) => (
                <DropdownMenuItem
                  key={`${g.groupLabel}-${opt.value}`}
                  onMouseDown={(e) => {
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
                    if (handledRef.current) return;
                    handledRef.current = true;
                    handleSelect(opt);
                    requestAnimationFrame(() => {
                      handledRef.current = false;
                    });
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{opt.label}</span>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {opt.value.replace(/^\{\{|\}\}$/g, '')}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {gi < variableGroups.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InsertVariableMenu({
  variableGroups,
  onInsert,
  placeholder = '插入变量',
}: {
  variableGroups: GlobalVariableGroup[];
  onInsert: (template: string) => void;
  placeholder?: string;
}) {
  const handledRef = useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button type="button" variant="outline" size="sm">
          {placeholder}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] min-w-[280px] overflow-y-auto">
        {variableGroups.length ===0 && <DropdownMenuItem>暂无变量</DropdownMenuItem>}
        {variableGroups.map((g, gi) => (
          <div key={`${g.groupLabel}-${gi}`}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between">
                <span className="truncate">{g.groupLabel}</span>
                {g.groupHint && (
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {g.groupHint}
                  </span>
                )}
              </DropdownMenuLabel>
              {g.options.map((opt) => (
                <DropdownMenuItem
                  key={`${g.groupLabel}-${opt.value}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => {
                    if (handledRef.current) return;
                    handledRef.current = true;
                    onInsert(opt.value);
                    requestAnimationFrame(() => {
                      handledRef.current = false;
                    });
                  }}
                  onClick={() => {
                    if (handledRef.current) return;
                    handledRef.current = true;
                    onInsert(opt.value);
                    requestAnimationFrame(() => {
                      handledRef.current = false;
                    });
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{opt.label}</span>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {opt.value.replace(/^\{\{|\}\}$/g, '')}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {gi < variableGroups.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function tokenizeTemplateValue(value: string): Array<{ kind: 'text' | 'token'; raw: string }> {
  const parts: Array<{ kind: 'text' | 'token'; raw: string }> = [];
  const re = /\{\{[^}]+\}\}/g;
  let last = 0;
  for (;;) {
    const m = re.exec(value);
    if (!m) break;
    if (m.index > last) parts.push({ kind: 'text', raw: value.slice(last, m.index) });
    parts.push({ kind: 'token', raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < value.length) parts.push({ kind: 'text', raw: value.slice(last) });
  if (parts.length === 0) parts.push({ kind: 'text', raw: value });
  return parts;
}

function TokenInput({
  value,
  onChange,
  placeholder,
  className,
  hostRef,
  onCaretChange,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  hostRef?: React.RefObject<HTMLDivElement>;
  onCaretChange?: (caret: number) => void;
}) {
  const ref = hostRef ?? useRef<HTMLDivElement>(null);
  const parts = useMemo(() => tokenizeTemplateValue(value), [value]);
  const pendingCaretRef = useRef<number | null>(null);

  const tokenRanges = useCallback(() => {
    const ranges: Array<{ start: number; end: number }> = [];
    const re = /\{\{[^}]+\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value))) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
    return ranges;
  }, [value]);

  const getCaretIndex = useCallback((): number => {
    const root = ref.current;
    if (!root) return value.length;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return value.length;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer)) return value.length;
    let idx = 0;
    const nodes = Array.from(root.childNodes);
    for (const n of nodes) {
      if (n === range.startContainer) {
        if (n.nodeType === Node.TEXT_NODE) idx += range.startOffset;
        break;
      }
      if (n.nodeType === Node.TEXT_NODE) {
        idx += n.textContent?.length ?? 0;
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as HTMLElement;
        const tmpl = e.getAttribute('data-template');
        if (tmpl) idx += tmpl.length;
        else idx += e.textContent?.length ?? 0;
      }
    }
    return Math.max(0, Math.min(idx, value.length));
  }, [ref, value.length]);

  const setCaretIndex = useCallback(
    (pos: number) => {
      const root = ref.current;
      if (!root) return;
      const range = document.createRange();
      const sel = window.getSelection();
      let idx = 0;
      let placed = false;
      const children = Array.from(root.childNodes);
      for (const n of children) {
        if (placed) break;
        if (n.nodeType === Node.TEXT_NODE) {
          const len = n.textContent?.length ?? 0;
          if (idx + len >= pos) {
            range.setStart(n, Math.max(0, pos - idx));
            range.collapse(true);
            placed = true;
          } else {
            idx += len;
          }
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n as HTMLElement;
          const tmpl = el.getAttribute('data-template');
          const len = tmpl?.length ?? (el.textContent?.length ?? 0);
          if (idx + len >= pos) {
            // 光标落在 token 上时，放到 token 前或后（尽量放后）
            const parent = root;
            const atEnd = pos - idx >= len;
            const offset = Array.prototype.indexOf.call(parent.childNodes, n) + (atEnd ? 1 : 0);
            range.setStart(parent, offset);
            range.collapse(true);
            placed = true;
          } else {
            idx += len;
          }
        }
      }
      if (!placed) {
        range.selectNodeContents(root);
        range.collapse(false);
      }
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    },
    [ref],
  );

  const rebuildValueFromDom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const out: string[] = [];
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        out.push(n.textContent ?? '');
        return;
      }
      if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as HTMLElement;
        const tmpl = e.getAttribute('data-template');
        if (tmpl) out.push(tmpl);
        else out.push(e.textContent ?? '');
      }
    });
    const next = out.join('');
    if (next !== value) onChange(next);
  }, [onChange, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const caret = getCaretIndex();
      const ranges = tokenRanges();
      const isBackspace = e.key === 'Backspace';
      const targetPos = isBackspace ? caret - 1 : caret;
      const hit = ranges.find((r) => targetPos >= r.start && targetPos < r.end);
      if (!hit) return;
      e.preventDefault();
      const newVal = value.slice(0, hit.start) + value.slice(hit.end);
      pendingCaretRef.current = hit.start;
      onChange(newVal);
    },
    [getCaretIndex, tokenRanges, value, onChange],
  );

  // 在外部 value 更新后，如果有 pending caret，就恢复光标
  const prevValueRef = useRef<string>(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    requestAnimationFrame(() => {
      const pos = pendingCaretRef.current;
      if (pos != null) {
        pendingCaretRef.current = null;
        setCaretIndex(pos);
      }
    });
  }

  return (
    <div
      key={value}
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder ?? ''}
      className={`${className ?? ''} flex flex-wrap items-center gap-1 py-1.5`}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        rebuildValueFromDom();
        onCaretChange?.(getCaretIndex());
      }}
      onKeyUp={() => onCaretChange?.(getCaretIndex())}
      onMouseUp={() => onCaretChange?.(getCaretIndex())}
      onSelect={() => onCaretChange?.(getCaretIndex())}
    >
      {parts.map((p, i) =>
        p.kind === 'token' ? (
          <span key={`${p.raw}-${i}`} data-template={p.raw} contentEditable={false}>
            <Badge variant="secondary" className="font-mono text-[11px]">
              {p.raw.replace(/^\{\{|\}\}$/g, '')}
            </Badge>
          </span>
        ) : (
          <span key={`${p.raw}-${i}`}>{p.raw}</span>
        ),
      )}
    </div>
  );
}

function KvRowEditor({
  row,
  variableGroups,
  inputClassName,
  onChange,
  onDelete,
}: {
  row: KvRow;
  variableGroups: GlobalVariableGroup[];
  inputClassName: string;
  onChange: (next: KvRow) => void;
  onDelete: () => void;
}) {
  const caretRef = useRef<number>(row.value.length);
  return (
    <div className="flex items-end gap-2">
      <Input value={row.key} onChange={(e) => onChange({ ...row, key: e.target.value })} placeholder="key" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <InsertVariableMenu
            variableGroups={variableGroups}
            placeholder="插入变量"
            onInsert={(tmpl) => {
              const pos = caretRef.current ?? row.value.length;
              onChange({
                ...row,
                value: (row.value ?? '').slice(0, pos) + tmpl + (row.value ?? '').slice(pos),
              });
              caretRef.current = pos + tmpl.length;
            }}
          />
        </div>
        <TokenInput
          value={row.value}
          onChange={(v) => onChange({ ...row, value: v })}
          placeholder="{{inputs.message}}"
          className={inputClassName}
          onCaretChange={(c) => {
            caretRef.current = c;
          }}
        />
      </div>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="删除">
        ×
      </Button>
    </div>
  );
}

interface NodeConfigPanelProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, nodes, edges, onUpdate, onClose }: NodeConfigPanelProps) {
  const baseData = (node?.data ?? {}) as Record<string, unknown>;
  const [label, setLabel] = useState((baseData.label as string) ?? '');

  // ai
  const aiData = baseData as AINodeData;
  const [model, setModel] = useState(
    aiData.model ?? (aiData.provider === 'bailian' ? 'qwen3.5-plus' : 'gpt-3.5-turbo'),
  );
  const [systemPrompt, setSystemPrompt] = useState(aiData.systemPrompt ?? '');
  const [userMapping, setUserMapping] = useState(
    aiData.inputMapping?.user ?? aiData.inputMapping?.content ?? '',
  );

  // input
  const inputData = baseData as InputNodeData;
  const [assignmentRows, setAssignmentRows] = useState<KvRow[]>(
    () => objectToRows(inputData.assignments ?? { message: '' }),
  );

  // output
  const outputData = baseData as OutputNodeData;
  const [outputRows, setOutputRows] = useState<KvRow[]>(
    () => objectToRows(outputData.outputMapping ?? { result: '{{inputs.message}}' }),
  );

  // http
  const httpData = baseData as { method?: string; url?: string; headers?: Record<string, string>; body?: string };
  const [httpMethod, setHttpMethod] = useState(httpData.method ?? 'GET');
  const [httpUrl, setHttpUrl] = useState(httpData.url ?? 'https://api.example.com');
  const [httpHeaderRows, setHttpHeaderRows] = useState<KvRow[]>(
    () => objectToRows((httpData.headers ?? {}) as Record<string, unknown>),
  );
  const [httpBody, setHttpBody] = useState(httpData.body ?? '');

  // condition_if
  const condIfData = baseData as { expression?: string };
  const [condIfExpression, setCondIfExpression] = useState(condIfData.expression ?? '{{inputs.score}} > 60');

  // condition_switch
  const condSwitchData = baseData as {
    variable?: string;
    cases?: Array<{ value: string; outputKey: string }>;
    defaultOutput?: string;
  };
  const [condSwitchVariable, setCondSwitchVariable] = useState(condSwitchData.variable ?? '{{inputs.type}}');
  const [condSwitchCases, setCondSwitchCases] = useState<
    Array<{ id: string; value: string; outputKey: string }>
  >(
    () =>
      (condSwitchData.cases ?? [
        { value: 'a', outputKey: 'a' },
        { value: 'b', outputKey: 'b' },
      ]).map((c, i) => ({
        value: c.value ?? '',
        outputKey: c.outputKey ?? `case${i}`,
        id: `case-${i}`,
      })),
  );
  const [condSwitchDefault, setCondSwitchDefault] = useState(condSwitchData.defaultOutput ?? '__default__');

  const prevNodeIdRef = useRef<string | null>(null);

  // 切换节点时：先把当前表单写回上一个节点（避免未点「应用」的编辑丢失），再同步为新节点的 data
  const nodeId = node?.id;
  useEffect(() => {
    if (!node) return;

    const prevId = prevNodeIdRef.current;
    if (prevId != null && prevId !== nodeId && onUpdate) {
      const prevNode = nodes.find((n) => n.id === prevId);
      if (prevNode) {
        const prevData = (prevNode.data ?? {}) as Record<string, unknown>;
        const type = (prevNode.type as string) || '';
        if (type === 'ai') {
          onUpdate(prevId, { ...prevData, label: label || 'AI 节点', model, systemPrompt, inputMapping: { user: userMapping } });
        } else if (type === 'input') {
          onUpdate(prevId, { ...prevData, label: label || '输入', assignments: rowsToObject(assignmentRows) as Record<string, unknown> });
        } else if (type === 'output') {
          onUpdate(prevId, { ...prevData, label: label || '输出', outputMapping: rowsToObject(outputRows) as Record<string, unknown> });
        } else if (type === 'http') {
          onUpdate(prevId, {
            ...prevData,
            label: label || 'HTTP',
            method: httpMethod,
            url: httpUrl,
            headers: rowsToObject(httpHeaderRows) as Record<string, string>,
            body: httpBody || undefined,
          });
        } else if (type === 'condition_if') {
          onUpdate(prevId, { ...prevData, label: label || '条件分支', expression: condIfExpression, trueOutput: 'true', falseOutput: 'false' });
        } else if (type === 'condition_switch') {
          const cases = condSwitchCases.map((c) => ({ value: c.value, outputKey: c.outputKey }));
          onUpdate(prevId, { ...prevData, label: label || '多分支', variable: condSwitchVariable, cases, defaultOutput: condSwitchDefault });
        } else {
          onUpdate(prevId, { ...prevData, label });
        }
      }
    }
    prevNodeIdRef.current = nodeId ?? null;

    const data = (node.data ?? {}) as Record<string, unknown>;
    setLabel((data.label as string) ?? '');
    setModel((data.model as string) ?? (data.provider === 'bailian' ? 'qwen3.5-plus' : 'gpt-3.5-turbo'));
    setSystemPrompt((data.systemPrompt as string) ?? '');
    setUserMapping((data.inputMapping as Record<string, string>)?.user ?? (data.inputMapping as Record<string, string>)?.content ?? '');
    setAssignmentRows(objectToRows((data.assignments ?? { message: '' }) as Record<string, unknown>));
    setOutputRows(objectToRows((data.outputMapping ?? { result: '{{inputs.message}}' }) as Record<string, unknown>));
    setHttpMethod((data.method as string) ?? 'GET');
    setHttpUrl((data.url as string) ?? 'https://api.example.com');
    setHttpHeaderRows(objectToRows((data.headers ?? {}) as Record<string, unknown>));
    setHttpBody((data.body as string) ?? '');
    setCondIfExpression((data.expression as string) ?? '{{inputs.score}} > 60');
    setCondSwitchVariable((data.variable as string) ?? '{{inputs.type}}');
    const cases = (data.cases as Array<{ value?: string; outputKey?: string }>) ?? [
      { value: 'a', outputKey: 'a' },
      { value: 'b', outputKey: 'b' },
    ];
    setCondSwitchCases(cases.map((c, i) => ({
      value: c.value ?? '',
      outputKey: c.outputKey ?? `case${i}`,
      id: `case-${i}`,
    })));
    setCondSwitchDefault((data.defaultOutput as string) ?? '__default__');
  // 仅依赖 nodeId/nodes/onUpdate；表单状态在切换瞬间仍为上一条节点的值，用于写回上一节点
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, nodes, onUpdate]);

  const refUserMapping = useRef<HTMLInputElement>(null);
  const savedUserMappingSelection = useRef<{ start: number; end: number } | null>(null);
  const userMappingCaretRef = useRef<number>(userMapping.length);

  const variableGroups = useMemo(
    () => (node && nodes.length ? buildGlobalVariableGroups(nodes, edges, node.id) : []),
    [node, nodes, edges],
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
      const parsed = rowsToObject(assignmentRows);
      onUpdate(node.id, {
        ...node.data,
        label: label || '输入',
        assignments: parsed as Record<string, unknown>,
      });
    } else if (node.type === 'output') {
      const parsed = rowsToObject(outputRows);
      onUpdate(node.id, {
        ...node.data,
        label: label || '输出',
        outputMapping: parsed as Record<string, unknown>,
      });
    } else if (node.type === 'http') {
      const headers = rowsToObject(httpHeaderRows) as Record<string, string>;
      onUpdate(node.id, {
        ...node.data,
        label: label || 'HTTP',
        method: httpMethod,
        url: httpUrl,
        headers,
        body: httpBody || undefined,
      });
    } else if (node.type === 'condition_if') {
      onUpdate(node.id, {
        ...node.data,
        label: label || '条件分支',
        expression: condIfExpression,
        trueOutput: 'true',
        falseOutput: 'false',
      });
    } else if (node.type === 'condition_switch') {
      const cases = condSwitchCases.map((c) => ({ value: c.value, outputKey: c.outputKey }));
      onUpdate(node.id, {
        ...node.data,
        label: label || '多分支',
        variable: condSwitchVariable,
        cases,
        defaultOutput: condSwitchDefault,
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
    assignmentRows,
    outputRows,
    httpMethod,
    httpUrl,
    httpHeaderRows,
    httpBody,
    condIfExpression,
    condSwitchVariable,
    condSwitchCases,
    condSwitchDefault,
    onUpdate,
    onClose,
  ]);

  if (!node) return null;
  const hasConfig =
    node.type === 'ai' ||
    node.type === 'input' ||
    node.type === 'output' ||
    node.type === 'http' ||
    node.type === 'condition_if' ||
    node.type === 'condition_switch';
  if (!hasConfig) {
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
          {node.type === 'ai'
            ? 'AI 节点配置'
            : node.type === 'input'
              ? '输入节点配置'
              : node.type === 'output'
                ? '输出节点配置'
                : node.type === 'http'
                  ? 'HTTP 节点配置'
                  : node.type === 'condition_if'
                    ? '条件分支配置'
                    : node.type === 'condition_switch'
                      ? '多分支配置'
                      : '节点配置'}
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
                variableGroups={variableGroups}
                inputRef={refUserMapping}
                value={userMapping}
                setValue={setUserMapping}
                savedSelectionRef={savedUserMappingSelection}
                placeholder="插入全局变量"
              />
            </div>
            <TokenInput
              value={userMapping}
              onChange={setUserMapping}
              placeholder="{{inputs.message}} 或 {{某节点ID.text}}"
              className={inputClassName}
              hostRef={refUserMapping}
              onCaretChange={(c) => {
                userMappingCaretRef.current = c;
                savedUserMappingSelection.current = { start: c, end: c };
              }}
            />
            <span className="text-xs text-muted-foreground">
              支持 {'{{inputs.xxx}}'}、{'{{节点ID}}'}、{'{{节点ID.字段}}'}
            </span>
          </div>
        </>
      )}

      {node.type === 'input' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">变量赋值</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setAssignmentRows((prev) => prev.concat({ id: `row-${Date.now()}`, key: '', value: '' }))
              }
            >
              + 添加
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {assignmentRows.map((r) => (
              <KvRowEditor
                key={r.id}
                row={r}
                variableGroups={variableGroups}
                inputClassName={inputClassName}
                onChange={(next) =>
                  setAssignmentRows((prev) => prev.map((x) => (x.id === r.id ? next : x)))
                }
                onDelete={() => setAssignmentRows((prev) => prev.filter((x) => x.id !== r.id))}
              />
            ))}
            {assignmentRows.length === 0 && (
              <div className="text-xs text-muted-foreground">暂无变量。点击“+ 添加”新增一行。</div>
            )}
          </div>
        </div>
      )}

      {node.type === 'output' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">输出映射</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setOutputRows((prev) => prev.concat({ id: `row-${Date.now()}`, key: '', value: '' }))
              }
            >
              + 添加
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {outputRows.map((r) => (
              <KvRowEditor
                key={r.id}
                row={r}
                variableGroups={variableGroups}
                inputClassName={inputClassName}
                onChange={(next) => setOutputRows((prev) => prev.map((x) => (x.id === r.id ? next : x)))}
                onDelete={() => setOutputRows((prev) => prev.filter((x) => x.id !== r.id))}
              />
            ))}
            {outputRows.length === 0 && (
              <div className="text-xs text-muted-foreground">暂无输出。点击“+ 添加”新增一行。</div>
            )}
          </div>
        </div>
      )}

      {node.type === 'http' && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>请求方法</Label>
            <select
              value={httpMethod}
              onChange={(e) => setHttpMethod(e.target.value)}
              className={inputClassName}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label className="mb-0">URL</Label>
              <InsertVariableMenu
                variableGroups={variableGroups}
                placeholder="插入变量"
                onInsert={(tmpl) => setHttpUrl((prev) => prev + tmpl)}
              />
            </div>
            <Input
              value={httpUrl}
              onChange={(e) => setHttpUrl(e.target.value)}
              placeholder="https://api.example.com"
              className={inputClassName}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="mb-0">请求头（可选）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setHttpHeaderRows((prev) =>
                    prev.concat({ id: `h-${Date.now()}`, key: 'Content-Type', value: 'application/json' }),
                  )
                }
              >
                + 添加
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {httpHeaderRows.map((r) => (
                <div key={r.id} className="grid grid-cols-[100px_1fr_auto] items-center gap-2">
                  <Input
                    value={r.key}
                    onChange={(e) =>
                      setHttpHeaderRows((prev) =>
                        prev.map((x) => (x.id === r.id ? { ...x, key: e.target.value } : x)),
                      )
                    }
                    placeholder="key"
                  />
                  <Input
                    value={r.value}
                    onChange={(e) =>
                      setHttpHeaderRows((prev) =>
                        prev.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)),
                      )
                    }
                    placeholder="value"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setHttpHeaderRows((prev) => prev.filter((x) => x.id !== r.id))}
                    aria-label="删除"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
          {httpMethod !== 'GET' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Label className="mb-0">请求体（可选）</Label>
                <InsertVariableMenu
                  variableGroups={variableGroups}
                  placeholder="插入变量"
                  onInsert={(tmpl) => setHttpBody((prev) => prev + tmpl)}
                />
              </div>
              <Textarea
                value={httpBody}
                onChange={(e) => setHttpBody(e.target.value)}
                placeholder='{"key": "{{inputs.message}}" }'
                rows={4}
                className={textareaClassName}
              />
            </div>
          )}
          <div className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
            <strong>传给下游：</strong>
            <code>{`{{${node.id}.data}}`}</code>、<code>{`{{${node.id}.status}}`}</code>、<code>{`{{${node.id}.raw}}`}</code>
          </div>
        </>
      )}

      {node.type === 'condition_if' && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label className="mb-0">条件表达式</Label>
              <InsertVariableMenu
                variableGroups={variableGroups}
                placeholder="插入变量"
                onInsert={(tmpl) => setCondIfExpression((prev) => prev + tmpl)}
              />
            </div>
            <Input
              value={condIfExpression}
              onChange={(e) => setCondIfExpression(e.target.value)}
              placeholder="{{inputs.score}} > 60"
              className={inputClassName}
            />
            <span className="text-xs text-muted-foreground">
              支持比较：{'>'} {'<'}{' '}
              {'>='} {'<='} == !=，如 <code>{'{{inputs.score}} > 60'}</code>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            连接「是」handle 到 true 分支，「否」handle 到 false 分支
          </div>
        </>
      )}

      {node.type === 'condition_switch' && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label className="mb-0">匹配变量</Label>
              <InsertVariableMenu
                variableGroups={variableGroups}
                placeholder="插入变量"
                onInsert={(tmpl) => setCondSwitchVariable((prev) => prev + tmpl)}
              />
            </div>
            <Input
              value={condSwitchVariable}
              onChange={(e) => setCondSwitchVariable(e.target.value)}
              placeholder="{{inputs.type}}"
              className={inputClassName}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="mb-0">分支</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCondSwitchCases((prev) =>
                    prev.concat({ id: `case-${prev.length}`, value: '', outputKey: `case${prev.length}` }),
                  )
                }
              >
                + 添加
              </Button>
            </div>
            {condSwitchCases.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Input
                  value={c.value}
                  onChange={(e) =>
                    setCondSwitchCases((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)),
                    )
                  }
                  placeholder="匹配值"
                />
                <Input
                  value={c.outputKey}
                  onChange={(e) =>
                    setCondSwitchCases((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, outputKey: e.target.value } : x)),
                    )
                  }
                  placeholder="handle ID"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCondSwitchCases((prev) => prev.filter((x) => x.id !== c.id))}
                  aria-label="删除"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>默认分支 handle</Label>
            <Input
              value={condSwitchDefault}
              onChange={(e) => setCondSwitchDefault(e.target.value)}
              placeholder="__default__"
              className={inputClassName}
            />
            <span className="text-xs text-muted-foreground">
              无匹配时走此分支，需与下方连线 targetHandle 对应
            </span>
          </div>
        </>
      )}

      <Button type="button" onClick={handleApply}>
        应用
      </Button>
    </div>
  );
}
