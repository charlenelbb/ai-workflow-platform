import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { AppApiKeyService } from './app-api-key.service';
import { SimpleRateLimitService } from './simple-rate-limit.service';

type RunRequest = {
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class AppApiKeyGuard implements CanActivate {
  constructor(
    private readonly appApiKeyService: AppApiKeyService,
    private readonly rateLimit: SimpleRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RunRequest>();
    const publicAppId = req.params?.appId;
    if (!publicAppId) {
      throw new UnauthorizedException('Missing appId');
    }

    const auth = req.headers['authorization'] ?? req.headers['Authorization'];
    const authStr = typeof auth === 'string' ? auth : Array.isArray(auth) ? auth[0] : undefined;
    if (!authStr) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const m = authStr.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1]?.trim();
    if (!token) {
      throw new UnauthorizedException('Invalid Authorization format');
    }

    // 限流：按「公开 appId + token」分桶，先于数据库校验，减轻暴破压力
    const bucketKey = createHash('sha256')
      .update(`${publicAppId}:${token}`, 'utf8')
      .digest('hex');
    this.rateLimit.assertWithinLimit(`app_run:${bucketKey}`);

    await this.appApiKeyService.assertValidKeyForApp(publicAppId, token);

    return true;
  }
}
