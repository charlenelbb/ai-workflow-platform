/**
 * 可拖拽调整宽度的面板（用于右侧运行面板，默认 320px）
 */
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 560;

interface ResizablePanelProps {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

export function ResizablePanel({
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
  side,
  children,
  className,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const next = side === 'right' ? document.body.scrollWidth - e.clientX : e.clientX;
      setWidth(Math.min(maxWidth, Math.max(minWidth, next)));
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, side, minWidth, maxWidth]);

  return (
    <div
      className={cn('relative flex shrink-0 flex-col', className)}
      style={{ width, minWidth: width }}
    >
      {side === 'right' && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onMouseDown}
          className={cn(
            'absolute left-0 top-0 z-10 w-1 cursor-col-resize select-none transition-colors hover:bg-[var(--primary)]',
            dragging && 'bg-[var(--primary)]',
          )}
          style={{ height: '100%' }}
        />
      )}
      {side === 'left' && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onMouseDown}
          className={cn(
            'absolute right-0 top-0 z-10 w-1 cursor-col-resize select-none transition-colors hover:bg-[var(--primary)]',
            dragging && 'bg-[var(--primary)]',
          )}
          style={{ height: '100%' }}
        />
      )}
      <div className="flex h-full flex-col overflow-hidden">{children}</div>
    </div>
  );
}
