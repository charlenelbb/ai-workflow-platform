import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { PublishedWorkflowExecutionService } from './published-workflow.service';
import { RunPublishedWorkflowDto } from './dto/run-published-workflow.dto';
import { AppApiKeyGuard } from '../app-api/app-api-key.guard';

@Controller('apps')
export class PublishedWorkflowExecutionController {
  constructor(
    private readonly publishedWorkflowExecutionService: PublishedWorkflowExecutionService,
  ) {}

  /**
   * 对外运行已发布工作流。
   * 完整路径（经前端 / Vite 代理）为 POST /api/apps/:appId/run
   */
  @UseGuards(AppApiKeyGuard)
  @Post(':appId/run')
  async run(@Param('appId') appId: string, @Body() body: RunPublishedWorkflowDto) {
    const inputs = body?.inputs ?? body?.input ?? {};
    return this.publishedWorkflowExecutionService.run(appId, inputs);
  }
}

