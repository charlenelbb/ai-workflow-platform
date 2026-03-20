import { Module } from '@nestjs/common';
import { AppApiKeyService } from './app-api-key.service';
import { AppApiKeyGuard } from './app-api-key.guard';
import { SimpleRateLimitService } from './simple-rate-limit.service';
import { AppApiKeysController } from './app-api-keys.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AppApiKeysController],
  providers: [AppApiKeyService, SimpleRateLimitService, AppApiKeyGuard],
  exports: [AppApiKeyService, SimpleRateLimitService, AppApiKeyGuard],
})
export class AppApiModule {}
