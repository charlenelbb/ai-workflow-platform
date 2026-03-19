/**
 * 可折叠侧边栏：左侧工作流列表 / 右侧运行面板
 * 折叠时仅显示窄条与折叠按钮，展开时显示完整内容
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CollapsibleSidePanelProps {
  side: 'left' | 'right';
  /** 展开时的宽度（px） */
  width?: number;
  children: React.ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
}

const COLLAPSED_WIDTH = 48;
const DEFAULT_WIDTH = { left: 260, right: 320 };

export function CollapsibleSidePanel({
  side,
  width = DEFAULT_WIDTH[side],
  children,
  className,
  defaultCollapsed = false,
}: CollapsibleSidePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const Icon = collapsed ? (side === 'left' ? PanelLeftOpen : PanelRightOpen) : (side === 'left' ? PanelLeftClose : PanelRightClose);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_WIDTH : width }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden border-border bg-card shadow-sm',
        side === 'left' ? 'border-r' : 'border-l',
        className,
      )}
    >
      {collapsed ? (
        <div className="flex h-full flex-col items-center justify-start pt-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(false)}
            aria-label="展开面板"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex h-full flex-col overflow-auto gap-6">{children}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'absolute top-1/2 h-8 w-6 -translate-y-1/2 rounded-md border border-border bg-card shadow-sm',
              side === 'left' ? 'right-0 rounded-r-none border-r-0' : 'left-0 rounded-l-none border-l-0',
            )}
            onClick={() => setCollapsed(true)}
            aria-label="收起面板"
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </motion.aside>
  );
}
