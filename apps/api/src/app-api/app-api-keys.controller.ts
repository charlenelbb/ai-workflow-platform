import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Param,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { AppApiKeyService } from './app-api-key.service';
import { CreateAppApiKeyDto } from './dto/create-app-api-key.dto';

/**
 * 管理接口：创建 App 的 API Key（明文只返回一次）。
 * 需在请求头携带 X-Admin-Secret，与环境变量 ADMIN_API_SECRET 一致。
 */
@Controller('apps')
export class AppApiKeysController {
  constructor(
    private readonly appApiKeyService: AppApiKeyService,
    private readonly config: ConfigService,
  ) {}

  private assertAdmin(provided: string | undefined): void {
    const expected = this.config.get<string>('ADMIN_API_SECRET')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        '未配置 ADMIN_API_SECRET，无法通过 HTTP 创建 ApiKey。请在 apps/api/.env 中设置后重启服务。',
      );
    }
    const p = (provided ?? '').trim();
    const a = Buffer.from(p, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid X-Admin-Secret');
    }
  }

  @Post(':appId/api-keys')
  async create(
    @Param('appId') appId: string,
    @Body() body: CreateAppApiKeyDto,
    @Headers('x-admin-secret') xAdminSecret: string | undefined,
  ) {
    this.assertAdmin(xAdminSecret);
    return this.appApiKeyService.createApiKeyForPublicApp(appId, body?.name);
  }
}
