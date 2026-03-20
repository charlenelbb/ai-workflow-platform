import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 进程内简单固定窗口限流（适合单实例；多实例需 Redis 等共享存储）。
 */
@Injectable()
export class SimpleRateLimitService {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly config: ConfigService) {}

  /** 超限抛出 429 */
  assertWithinLimit(bucketKey: string): void {
    const limit = Number.parseInt(
      this.config.get<string>('APP_RUN_RATE_LIMIT_PER_MIN') ?? '120',
      10,
    );
    const windowMs = 60_000;
    const now = Date.now();
    let b = this.buckets.get(bucketKey);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      this.buckets.set(bucketKey, b);
    }
    if (b.count >= limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    b.count += 1;
  }
}
