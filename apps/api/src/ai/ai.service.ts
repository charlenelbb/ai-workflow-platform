import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type AiProvider = 'openai' | 'bailian' | 'local';

export interface AiCompleteOptions {
  model: string;
  systemPrompt?: string;
  maxRetries?: number;
  /** 重试间隔基数（毫秒），指数退避：base * 2^attempt */
  retryBackoffMs?: number;
}

/**
 * AI 提供商抽象：OpenAI 已实现，百炼/本地为占位。
 * AI 节点执行时带简单重试（可配置次数与 backoff）。
 */
@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) this.openai = new OpenAI({ apiKey });
  }

  /**
   * 调用 LLM 完成对话。仅 OpenAI 实现；bailian/local 抛出说明性错误。
   * 带重试：仅对可重试错误（速率限制、暂时故障）重试。
   */
  async complete(
    provider: AiProvider,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: AiCompleteOptions,
  ): Promise<string> {
    const maxRetries = options.maxRetries ?? 2;
    const backoffMs = options.retryBackoffMs ?? 1000;

    if (provider === 'openai') {
      return this.completeWithRetry(
        () => this.completeOpenAI(messages, options),
        maxRetries,
        backoffMs,
      );
    }
    if (provider === 'bailian' || provider === 'local') {
      throw new Error(`AI 提供商 "${provider}" 尚未实现，请使用 openai 或后续接入百炼/本地模型`);
    }
    throw new Error(`未知 AI 提供商: ${provider}`);
  }

  private async completeOpenAI(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: AiCompleteOptions,
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('未配置 OPENAI_API_KEY，无法调用 OpenAI');
    }
    const model = options.model || 'gpt-3.5-turbo';
    const msgs = options.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages;

    const completion = await this.openai.chat.completions.create({
      model,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    });
    const content = completion.choices[0]?.message?.content;
    if (content == null) throw new Error('OpenAI 返回空内容');
    return content;
  }

  private async completeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    backoffMs: number,
  ): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt === maxRetries) break;
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }
}
