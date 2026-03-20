import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ExecutionProcessor } from './execution.processor';
import { AiModule } from '../ai/ai.module';
import { PublishedWorkflowExecutionController } from './published-workflow.controller';
import { PublishedWorkflowExecutionService } from './published-workflow.service';
import { AppApiModule } from '../app-api/app-api.module';
@Module({
  imports: [
    AiModule,
    AppApiModule,
    BullModule.registerQueue({ name: 'workflow-execution' }),
  ],
  controllers: [ExecutionController, PublishedWorkflowExecutionController],
  providers: [ExecutionService, ExecutionProcessor, PublishedWorkflowExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}