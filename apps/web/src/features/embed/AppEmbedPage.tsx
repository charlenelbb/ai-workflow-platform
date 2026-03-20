import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, KeyRound } from 'lucide-react';
import { runPublishedApp, type PublishedAppRunResult } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type ChatRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  raw?: unknown;
}

function formatOutputsForChat(outputs: unknown): string {
  if (outputs == null) return '（无输出）';
  if (typeof outputs !== 'object') return String(outputs);
  const o = outputs as Record<string, unknown>;
  const pick = o.reply ?? o.text ?? o.result ?? o.answer ?? o.content ?? o.output;
  if (pick != null && typeof pick === 'string') return pick;
  if (pick != null && typeof pick === 'object') {
    try {
      return JSON.stringify(pick, null, 2);
    } catch {
      return String(pick);
    }
  }
  try {
    return JSON.stringify(outputs, null, 2);
  } catch {
    return String(outputs);
  }
}

export function AppEmbedPage() {
  const { appId } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const keyFromUrl = useMemo(() => {
    const a = searchParams.get('api_key') ?? searchParams.get('key');
    return a?.trim() || '';
  }, [searchParams]);
  const inputField = useMemo(
    () => (searchParams.get('inputField') ?? searchParams.get('field') ?? 'query').trim() || 'query',
    [searchParams],
  );

  const [apiKey, setApiKey] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (keyFromUrl) setApiKey(keyFromUrl);
  }, [keyFromUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!appId || !text || sending) return;
    const key = apiKey.trim();
    if (!key) {
      setErrorBanner('请先填写 API Key，或通过链接参数 ?api_key= 传入（注意：密钥会出现在浏览器记录中）。');
      return;
    }
    setErrorBanner(null);
    setDraft('');
    appendMessage({ id: crypto.randomUUID(), role: 'user', text });
    setSending(true);

    try {
      const inputs = { [inputField]: text };
      const result = (await runPublishedApp(appId, key, inputs)) as PublishedAppRunResult;
      if (result.status === 'failed') {
        const errText = result.error ?? '执行失败';
        appendMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: errText,
          raw: result,
        });
      } else {
        appendMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: formatOutputsForChat(result.outputs),
          raw: result,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `请求失败：${msg}`,
      });
    } finally {
      setSending(false);
    }
  }, [appId, apiKey, draft, sending, inputField, appendMessage]);

  const onKeyDownArea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!appId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-muted-foreground">
        缺少应用 ID
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 shadow-[var(--shadow-sm)]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-sm font-bold text-foreground">已发布应用</h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">{appId}</p>
          </div>
          {keyFromUrl ? (
            <p className="flex items-center gap-2 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/5 px-3 py-2 text-xs text-foreground">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
              <span>已通过链接携带 API Key，无需再填，可直接在下方发送消息。</span>
            </p>
          ) : (
            <div className="flex w-full flex-col gap-1.5 sm:max-w-xs">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                API Key
              </label>
              <Input
                type="password"
                autoComplete="off"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-9"
              />
            </div>
          )}
        </div>
        {errorBanner && (
          <p className="mx-auto mt-3 max-w-3xl rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
            {errorBanner}
          </p>
        )}
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/80 p-8 text-center text-sm text-muted-foreground">
              在下方输入内容并发送，将调用已发布工作流（请求体字段「{inputField}」）。
              <br />
              <span className="text-xs">可用 URL 参数自定义：`?inputField=message`</span>
            </div>
          )}
          {messages.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-[var(--shadow-sm)]',
                  m.role === 'user'
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] rounded-br-md'
                    : 'rounded-bl-md border border-border bg-card text-card-foreground',
                )}
              >
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            </motion.div>
          ))}
          {sending && (
            <div className="text-xs text-muted-foreground">思考中…</div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t border-border bg-card p-4 shadow-[var(--shadow-sm)]">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            placeholder={`输入后按 Enter 发送（Shift+Enter 换行）…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDownArea}
            rows={3}
            disabled={sending}
            className="min-h-[80px] flex-1 resize-y rounded-xl border-border text-sm"
          />
          <Button
            type="button"
            className="h-11 shrink-0 rounded-xl bg-[var(--primary)] px-6 font-semibold text-white hover:bg-[var(--primary-hover)] sm:h-auto sm:self-stretch"
            disabled={sending || !draft.trim()}
            onClick={() => void handleSend()}
          >
            <Send className="mr-2 h-4 w-4" />
            发送
          </Button>
        </div>
      </footer>
    </div>
  );
}
