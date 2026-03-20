import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, KeyRound, Loader2 } from 'lucide-react';
import { runPublishedApp, type PublishedAppRunResult } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from '@/features/embed/ChatMarkdown';

/** 距底部小于此值视为「在底部」，恢复自动滚动 */
const STICK_THRESHOLD_PX = 72;

type ChatRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  raw?: unknown;
  typewriter?: boolean;
}

function TypewriterText({
  text,
  onTick,
  className,
}: {
  text: string;
  onTick?: () => void;
  className?: string;
}) {
  const [shown, setShown] = useState('');
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!text) {
      setShown('');
      return;
    }
    let i = 0;
    const len = text.length;
    const chunk = len > 2000 ? 6 : len > 800 ? 4 : len > 200 ? 3 : 2;
    const intervalMs = 18;
    setShown('');
    if (len === 0) return;
    const id = window.setInterval(() => {
      i = Math.min(len, i + chunk);
      setShown(text.slice(0, i));
      tickRef.current?.();
      if (i >= len) {
        window.clearInterval(id);
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <div className={cn('min-w-0 break-words', className)}>
      <ChatMarkdown content={shown} />
      {shown.length < text.length ? (
        <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-[var(--primary)] align-middle opacity-80" />
      ) : null}
    </div>
  );
}

function AiLoadingBubble() {
  return (
    <div className="flex max-w-[85%] items-center gap-3 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm shadow-[var(--shadow-sm)]">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--primary)]" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground/90">AI 正在思考</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="embed-ai-loading-dot" style={{ animationDelay: '0ms' }} />
            <span className="embed-ai-loading-dot" style={{ animationDelay: '140ms' }} />
            <span className="embed-ai-loading-dot" style={{ animationDelay: '280ms' }} />
          </span>
        </div>
        <div className="embed-ai-loading-bar" aria-hidden />
      </div>
    </div>
  );
}

const MAX_CONVERSATION_HISTORY_MESSAGES = 40;

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  /** 为 true 时：新消息、打字机、loading 会滚动到底部 */
  const stickToBottomRef = useRef(true);
  const ignoreScrollUntilRef = useRef(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    ignoreScrollUntilRef.current = Date.now() + 150;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const updateStickFromScroll = useCallback(() => {
    if (Date.now() < ignoreScrollUntilRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= STICK_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    if (keyFromUrl) setApiKey(keyFromUrl);
  }, [keyFromUrl]);

  /** 新消息或进入 loading 时，若在底部则跟到底 */
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom(sending ? 'auto' : 'smooth');
      });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, sending, scrollToBottom]);

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

    stickToBottomRef.current = true;

    const priorForApi = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }));
    const conversationHistory =
      priorForApi.length > MAX_CONVERSATION_HISTORY_MESSAGES
        ? priorForApi.slice(priorForApi.length - MAX_CONVERSATION_HISTORY_MESSAGES)
        : priorForApi;

    appendMessage({ id: crypto.randomUUID(), role: 'user', text });
    setSending(true);

    try {
      const inputs: Record<string, unknown> = {
        [inputField]: text,
        ...(conversationHistory.length > 0 ? { conversationHistory } : {}),
      };
      const result = (await runPublishedApp(appId, key, inputs)) as PublishedAppRunResult;
      if (result.status === 'failed') {
        const errText = result.error ?? '执行失败';
        appendMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: errText,
          raw: result,
          typewriter: false,
        });
      } else {
        appendMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: formatOutputsForChat(result.outputs),
          raw: result,
          typewriter: true,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `请求失败：${msg}`,
        typewriter: false,
      });
    } finally {
      setSending(false);
    }
  }, [appId, apiKey, draft, sending, inputField, appendMessage, messages]);

  const onKeyDownArea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const onTypewriterTick = useCallback(() => {
    if (stickToBottomRef.current) {
      scrollToBottom('auto');
    }
  }, [scrollToBottom]);

  if (!appId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-muted-foreground">
        缺少应用 ID
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-background text-foreground">
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

      <div
        ref={scrollContainerRef}
        onScroll={updateStickFromScroll}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/80 p-8 text-center text-sm text-muted-foreground">
              在下方输入内容并发送；输入+AI+输出类工作流会<strong>带上历史对话</strong>，多轮提问时 AI 可结合上下文回答（字段「{inputField}」为当前句）。
              <br />
              <span className="text-xs">
                输入节点 assignments 建议使用 <code className="font-mono">{`{{inputs.${inputField}}}`}</code>{' '}
                ；URL 可带 <code className="font-mono">?inputField=message</code>
              </span>
              <p className="mt-3 text-xs text-muted-foreground">
                向上滚动查看历史时会<strong>暂停自动滚到底</strong>；滚回底部或再次发送后恢复。
              </p>
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
                {m.role === 'assistant' && m.typewriter !== false ? (
                  <TypewriterText text={m.text} onTick={onTypewriterTick} />
                ) : m.role === 'assistant' ? (
                  <ChatMarkdown content={m.text} />
                ) : (
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                )}
              </div>
            </motion.div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <AiLoadingBubble />
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-card px-4 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            placeholder={`输入后按 Enter 发送（Shift+Enter 换行）…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDownArea}
            rows={3}
            disabled={sending}
            className="min-h-[80px] flex-1 resize-y rounded-xl border-border bg-background text-sm"
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
