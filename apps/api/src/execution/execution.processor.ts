import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ExecutionService } from './execution.service';
@Processor('workflow-execution')
export class ExecutionProcessor extends WorkerHost {
  constructor(private readonly executionService: ExecutionService) {
    super();
  }

  async process(job: Job<{ runId: string }>): Promise<void> {
    const { runId } = job.data;
    await this.executionService.executeRunJob(runId);
  }
}
