/**
 * 底部运行输入区：默认收起，只显示标题与展开箭头；展开后显示 JSON 输入框与运行按钮
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface BottomRunInputProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  disabled?: boolean;
  running?: boolean;
  placeholder?: string;
  className?: string;
}

export function BottomRunInput({
  value,
  onChange,
  onRun,
  disabled = false,
  running = false,
  placeholder = '{"message":"hello"}',
  className,
}: BottomRunInputProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col border-t border-border bg-card shadow-sm',
        className,
      )}
    >
      {/* 标题栏：始终可见，点击展开/收起 */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex h-10 shrink-0 items-center justify-between gap-2 px-4 text-left text-sm font-semibold text-foreground hover:bg-[var(--muted)] transition-colors"
      >
        <span>运行输入 (JSON)</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={6}
                className="mb-3 w-full resize-y rounded-lg border-border font-mono text-sm"
              />
              <Button
                type="button"
                className="w-full bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold h-9"
                onClick={onRun}
                disabled={disabled || running}
              >
                {running ? '运行中…' : '运行当前工作流'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
