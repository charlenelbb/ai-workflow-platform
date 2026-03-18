import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ExecutionProcessor } from './execution.processor';
import { AiModule } from '../ai/ai.module';
@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({ name: 'workflow-execution' }),
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionProcessor],
  exports: [ExecutionService],
})
export class ExecutionModule {}