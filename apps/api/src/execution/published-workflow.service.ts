import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from './execution.service';

type WorkflowGraph = {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
};

@Injectable()
export class PublishedWorkflowExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executionService: ExecutionService,
  ) {}

  /**
   * 运行已发布工作流：根据 appId 找到绑定的 WorkflowVersion.snapshot.graph，
   * 然后调用执行引擎执行，并把 RunRecord/NodeLogs 写入数据库。
   */
  async run(appId: string, inputs: Record<string, unknown> = {}) {
    const app = await this.prisma.app.findUnique({
      where: { appId },
      select: { id: true, workflowId: true, workflowVersionId: true },
    });

    if (!app) throw new NotFoundException('App not found');

    const workflowVersion = await this.prisma.workflowVersion.findUnique({
      where: { id: app.workflowVersionId },
      select: { id: true, version: true, snapshot: true },
    });

    if (!workflowVersion) throw new NotFoundException('WorkflowVersion not found');

    const snapshot = workflowVersion.snapshot as unknown as { graph?: unknown };
    const graph = snapshot.graph as WorkflowGraph | undefined;

    if (!graph || !Array.isArray((graph as WorkflowGraph).nodes) || !Array.isArray((graph as WorkflowGraph).edges)) {
      throw new BadRequestException('Invalid workflowVersion.snapshot.graph');
    }

    return this.executionService.executeSnapshot(
      app.workflowId,
      workflowVersion.version,
      graph,
      inputs,
    );
  }
}

