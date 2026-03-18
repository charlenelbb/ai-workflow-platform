import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type AiProvider = 'openai' | 'bailian' | 'local';

/** 百炼默认模型（千问 3.5 Plus） */
export const BAILIAN_DEFAULT_MODEL = 'qwen3.5-plus';

export interface AiCompleteOptions {
  model: string;
  systemPrompt?: string;
  maxRetries?: number;
  /** 重试间隔基数（毫秒），指数退避：base * 2^attempt */
  retryBackoffMs?: number;
}

/**
 * AI 提供商抽象：OpenAI、百炼（DashScope）已实现；本地为占位。
 * 默认使用百炼 qwen3.5-plus。AI 节点执行时带简单重试。
 */
@Injectable()
export class AiService {
  private openai: OpenAI | null = null;
  private bailianApiKey: string | null = null;
  private bailianBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) this.openai = new OpenAI({ apiKey });
    const dashscopeKey = this.config.get<string>('DASHSCOPE_API_KEY');
    if (dashscopeKey) this.bailianApiKey = dashscopeKey;
    const baseUrl = this.config.get<string>('DASHSCOPE_BASE_URL');
    if (baseUrl) this.bailianBaseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * 调用 LLM 完成对话。OpenAI、百炼已实现；local 为占位。带重试。
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
    if (provider === 'bailian') {
      return this.completeWithRetry(
        () => this.completeBailian(messages, options),
        maxRetries,
        backoffMs,
      );
    }
    if (provider === 'local') {
      throw new Error('AI 提供商 "local" 尚未实现，请使用 openai 或 bailian');
    }
    throw new Error(`未知 AI 提供商: ${provider}`);
  }

  private async completeBailian(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: AiCompleteOptions,
  ): Promise<string> {
    if (!this.bailianApiKey) {
      throw new Error('未配置 DASHSCOPE_API_KEY，无法调用百炼');
    }
    const model = options.model || BAILIAN_DEFAULT_MODEL;
    const msgs = options.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages;

    const res = await fetch(`${this.bailianBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.bailianApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`百炼 API 错误 ${res.status}: ${text}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (content == null) throw new Error('百炼返回空内容');
    return content;
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
