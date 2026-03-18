import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ExecutionService } from './execution.service';

@Controller('runs')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post()
  async startRun(
    @Body() body: { workflowId: string; inputs?: Record<string, unknown> },
  ) {
    const { workflowId, inputs = {} } = body;
    return this.executionService.startRun(workflowId, inputs);
  }

  @Get('workflow/:workflowId')
  getRunsByWorkflow(
    @Param('workflowId') workflowId: string,
    @Query('limit') limit?: string,
  ) {
    return this.executionService.getRunsByWorkflow(
      workflowId,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':runId')
  getRun(@Param('runId') runId: string) {
    return this.executionService.getRun(runId);
  }
}
