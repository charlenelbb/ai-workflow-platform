import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 text-[0.9375rem] leading-relaxed last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 border-b border-border pb-1 text-lg font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-[0.9375rem]">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-[0.9375rem]">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[var(--primary)] underline decoration-[var(--primary)]/40 underline-offset-2 hover:opacity-90"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-[3px] border-[var(--primary)]/50 bg-muted/40 py-1 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  code: ({ className, children, ...props }) => {
    const inline = Boolean((props as { inline?: boolean }).inline);
    if (inline) {
      return (
        <code
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-foreground [word-break:break-word]"
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn('block w-full font-mono text-[0.8125rem] text-foreground', className)} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 max-h-[min(360px,50vh)] overflow-x-auto overflow-y-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[240px] border-collapse text-left text-[0.8125rem]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border bg-muted/40">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-foreground">{children}</td>,
};

export function ChatMarkdown({ content, className }: { content: string; className?: string }) {
  if (!content) return null;
  return (
    <div className={cn('embed-chat-md text-foreground', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
