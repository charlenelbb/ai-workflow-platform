import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * App 对外 API Key：明文不落库，仅校验 sha256 哈希（与创建时写入的 keyHash 一致）。
 */
@Injectable()
export class AppApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** 生成入库的哈希串，格式 sha256:&lt;hex&gt; */
  static hashPlainKey(plain: string): string {
    const digest = createHash('sha256').update(plain, 'utf8').digest('hex');
    return `sha256:${digest}`;
  }

  private plainKeyToDigestBuffer(plain: string): Buffer {
    return createHash('sha256').update(plain, 'utf8').digest();
  }

  /** 将库中的 keyHash 转为 32 字节 Buffer，便于 timingSafeEqual */
  private storedHashToDigestBuffer(stored: string): Buffer | null {
    const s = stored.trim();
    if (s.startsWith('sha256:')) {
      const hex = s.slice('sha256:'.length);
      if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
      return Buffer.from(hex, 'hex');
    }
    if (/^[0-9a-f]{64}$/i.test(s)) {
      return Buffer.from(s, 'hex');
    }
    return null;
  }

  /**
   * 校验：公开 appId（如 app_xxx）+ 明文 API Key；匹配则更新 lastUsedAt。
   * @throws UnauthorizedException
   */
  async assertValidKeyForApp(publicAppId: string, plainKey: string): Promise<void> {
    const token = plainKey?.trim();
    if (!token) {
      throw new UnauthorizedException('Missing API key');
    }

    const app = await this.prisma.app.findUnique({
      where: { appId: publicAppId },
      select: { id: true },
    });
    if (!app) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const keys = await this.prisma.apiKey.findMany({
      where: { appId: app.id },
      select: { id: true, keyHash: true },
    });

    const digest = this.plainKeyToDigestBuffer(token);
    let matchedId: string | null = null;

    for (const row of keys) {
      const expected = this.storedHashToDigestBuffer(row.keyHash);
      if (!expected || expected.length !== digest.length) continue;
      try {
        if (timingSafeEqual(digest, expected)) {
          matchedId = row.id;
          break;
        }
      } catch {
        // length mismatch already filtered; ignore
      }
    }

    if (!matchedId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.apiKey.update({
      where: { id: matchedId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * 为对外 appId（如 app_xxx）新建 ApiKey；**明文仅在此返回值中出现一次**。
   */
  async createApiKeyForPublicApp(
    publicAppId: string,
    name?: string | null,
  ): Promise<{ id: string; name: string | null; apiKey: string; createdAt: Date }> {
    const app = await this.prisma.app.findUnique({
      where: { appId: publicAppId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('App not found');

    const apiKey = `sk_${randomBytes(32).toString('base64url')}`;
    const keyHash = AppApiKeyService.hashPlainKey(apiKey);

    const row = await this.prisma.apiKey.create({
      data: {
        appId: app.id,
        keyHash,
        name: name?.trim() ? name.trim() : null,
      },
    });

    return {
      id: row.id,
      name: row.name,
      apiKey,
      createdAt: row.createdAt,
    };
  }
}
