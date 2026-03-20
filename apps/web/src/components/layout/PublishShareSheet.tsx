import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_HINT =
  '未带密钥的链接：请在 apps/api/.env 配置 ADMIN_API_SECRET（并重启），发布时会自动生成密钥并写入上方链接；或通过 POST /api/apps/<appId>/api-keys 创建。详见 docs/PUBLISH_DESIGN.md。';

export interface PublishShareSheetProps {
  appId: string;
  /** 本次发布返回的明文密钥，仅用于拼接 ?api_key=（勿公开发布） */
  embedApiKey?: string;
  onClose: () => void;
}

export function PublishShareSheet({ appId, embedApiKey, onClose }: PublishShareSheetProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedPathBase = `/apps/${encodeURIComponent(appId)}/embed`;
  const embedQuery = embedApiKey
    ? `?api_key=${encodeURIComponent(embedApiKey)}`
    : '';
  const embedPath = `${embedPathBase}${embedQuery}`;
  const embedUrl = `${origin}${embedPath}`;
  const apiPath = `/api/apps/${encodeURIComponent(appId)}/run`;
  const apiUrl = `${origin}${apiPath}`;

  const curlExample = useMemo(() => {
    const token = embedApiKey ?? 'YOUR_API_KEY';
    return `curl -sS -X POST '${apiUrl}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -d '{"inputs":{"query":"你好"}}'`;
  }, [apiUrl, embedApiKey]);

  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-sheet-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="publish-sheet-title" className="text-lg font-bold text-foreground">
              发布成功
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              以下为嵌入页与对外 API。发布内容来自<strong>当前服务器已保存</strong>的工作流，若刚改画布请先点「保存」。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 text-sm">
          <section>
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">App ID</div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{appId}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => void copy('appId', appId)}
              >
                {copied === 'appId' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </section>

          {embedApiKey ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100/90">
              嵌入链接已附带 <code className="font-mono">api_key</code>，打开即可对话，无需再填密钥。注意：链接待谨慎分享（可能出现在浏览器历史、Referer、日志中）。
            </p>
          ) : (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              本次未返回密钥：请配置 <code className="font-mono">ADMIN_API_SECRET</code> 后重新发布，或手动创建
              ApiKey 并自行在链接后拼接 <code className="font-mono">?api_key=</code>。
            </p>
          )}

          <section>
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">嵌入网页（对话）</div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={embedPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--primary)] underline-offset-2 hover:underline text-xs font-medium"
              >
                新窗口打开{embedApiKey ? '（已含密钥）' : ''}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void copy('embed', embedUrl)}
              >
                {copied === 'embed' ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5" /> 已复制链接
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" /> 复制完整 URL
                  </>
                )}
              </Button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-background/80 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {embedUrl}
            </pre>
            <p className="mt-1 text-[11px] text-muted-foreground">
              iframe：<code className="font-mono">src=&quot;{embedUrl}&quot;</code>
            </p>
          </section>

          <section>
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">HTTP API</div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-[#23262E] p-3 font-mono text-[11px] leading-relaxed text-[#E5E6EB]">
              {curlExample}
            </pre>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void copy('curl', curlExample)}
              >
                {copied === 'curl' ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5" /> 已复制
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" /> 复制 curl
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void copy('apiUrl', apiUrl)}
              >
                仅复制 URL
              </Button>
            </div>
            {!embedApiKey ? (
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">{STORAGE_HINT}</p>
            ) : null}
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
            onClick={onClose}
          >
            完成
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
