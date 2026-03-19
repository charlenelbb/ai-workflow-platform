import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface NodeLogEntry {
  nodeId: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

interface NodeCardProps {
  log: NodeLogEntry;
  index: number;
}

export function NodeCard({ log, index }: NodeCardProps) {
  const isFailed = log.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn(
        'rounded-xl border p-4 shadow-sm transition-all duration-200',
        isFailed
          ? 'border-destructive/40 bg-destructive/5 hover:shadow-md'
          : 'border-border/60 bg-card hover:border-primary/20 hover:shadow-md',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-xs font-semibold text-foreground">{log.nodeId}</div>
        <Badge variant={isFailed ? 'destructive' : 'secondary'} className="text-[10px]">
          {log.status}
        </Badge>
      </div>
      {log.error && (
        <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{log.error}</div>
      )}
      <details className="mb-3 group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          输入
        </summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-[11px] font-mono border border-border/40">
          {JSON.stringify(log.input ?? {}, null, 2)}
        </pre>
      </details>
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          输出
        </summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-[11px] font-mono border border-border/40">
          {JSON.stringify(log.output ?? {}, null, 2)}
        </pre>
      </details>
    </motion.div>
  );
}
