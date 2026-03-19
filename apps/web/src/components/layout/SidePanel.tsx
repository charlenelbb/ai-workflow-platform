import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SidePanelProps {
  side?: 'left' | 'right';
  width?: string;
  className?: string;
  children: React.ReactNode;
}

const widthMap = {
  left: 'w-[260px] min-w-[260px]',
  right: 'w-[420px] min-w-[360px]',
};

export function SidePanel({
  side = 'left',
  width,
  className,
  children,
}: SidePanelProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex flex-col overflow-auto border-border bg-background',
        side === 'left' ? 'border-r' : 'border-l',
        width ?? widthMap[side],
        className,
      )}
    >
      {children}
    </motion.aside>
  );
}
