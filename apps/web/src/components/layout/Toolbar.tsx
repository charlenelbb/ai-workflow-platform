import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  className?: string;
  children: React.ReactNode;
}

export function Toolbar({ className, children }: ToolbarProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2',
        className,
      )}
    >
      {children}
    </motion.header>
  );
}
