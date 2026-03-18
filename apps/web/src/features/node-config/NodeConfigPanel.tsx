import { useCallback, useMemo, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
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
  if (type === 'plain') return '处理节点';
  if (type === 'start') return '开始';
  if (type === 'end') return '结束';
  return type;
}

function buildGlobalVariableGroups(nodes: Node[], currentNodeId: string): GlobalVariableGroup[] {
  const groups: GlobalVariableGroup[] = [
    {
      groupLabel: '运行输入',
      options: [
        { label: 'inputs（整体）', value: '{{inputs}}' },
        { label: 'inputs.message', value: '{{inputs.message}}' },
      ],
    },
  ];

  nodes.forEach((n) => {
    if (n.id === currentNodeId) return;
    const type = (n.type as string) || '';
    const name = nodeDisplayName(n);
    const hint = n.id;
    const options: GlobalVariableOption[] = [{ label: '输出（整体）', value: `{{${n.id}}}` }];
    if (type === 'ai') {
      options.push({ label: 'text', value: `{{${n.id}.text}}` });
      options.push({ label: 'content', value: `{{${n.id}.content}}` });
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
    <div className="grid grid-cols-[110px_1fr_auto] items-start gap-2">
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
  const [assignmentRows, setAssignmentRows] = useState<KvRow[]>(
    () => objectToRows(inputData.assignments ?? { message: '{{inputs.message}}' }),
  );

  // output
  const outputData = baseData as OutputNodeData;
  const [outputRows, setOutputRows] = useState<KvRow[]>(
    () => objectToRows(outputData.outputMapping ?? { result: '{{inputs.message}}' }),
  );

  const refUserMapping = useRef<HTMLInputElement>(null);
  const savedUserMappingSelection = useRef<{ start: number; end: number } | null>(null);
  const userMappingCaretRef = useRef<number>(userMapping.length);

  // 之前用于 textarea 选区插入的函数已不再需要（改为逐行 KV + TokenInput）。

  const variableGroups = useMemo(
    () => (node && nodes.length ? buildGlobalVariableGroups(nodes, node.id) : []),
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
          <div className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
            <strong>传给下游：</strong>使用 <code>{`{{${node.id}.text}}`}</code> 或 <code>{`{{${node.id}.content}}`}</code>（本节点 ID：<code>{node.id}</code>）
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
      <Button type="button" onClick={handleApply}>
        应用
      </Button>
    </div>
  );
}
