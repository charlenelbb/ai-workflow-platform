import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppApiKeyService } from '../app-api/app-api-key.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly appApiKeyService: AppApiKeyService,
  ) {}

  /** 生成对外唯一的 appId */
  private generateAppId(): string {
    return `app_${randomBytes(12).toString('hex')}`;
  }

  /**
   * 发布工作流：生成快照、创建 WorkflowVersion、自动创建或更新 App，返回 appId。
   * 若配置了 ADMIN_API_SECRET 且未设置 PUBLISH_AUTO_EMBED_API_KEY=false，会再生成一把 ApiKey，
   * 仅在本次响应中返回明文 **apiKey**（用于嵌入链接 ?api_key=）。
   */
  async publish(workflowId: string): Promise<{ appId: string; apiKey?: string }> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');

    const snapshot = {
      name: workflow.name,
      description: workflow.description,
      graph: workflow.graph,
      variables: workflow.variables,
    } as object;

    const nextVersion =
      (await this.prisma.workflowVersion
        .aggregate({ where: { workflowId }, _max: { version: true } })
        .then((r: { _max: { version: number | null } }) => r._max.version ?? 0)) + 1;

    const result = await this.prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.create({
        data: {
          workflowId,
          version: nextVersion,
          snapshot,
        },
      });

      let app = await tx.app.findFirst({ where: { workflowId } });
      if (app) {
        app = await tx.app.update({
          where: { id: app.id },
          data: { workflowVersionId: version.id, name: workflow.name, updatedAt: new Date() },
        });
      } else {
        let appId = this.generateAppId();
        while (await tx.app.findUnique({ where: { appId } })) {
          appId = this.generateAppId();
        }
        app = await tx.app.create({
          data: {
            appId,
            name: workflow.name,
            workflowId,
            workflowVersionId: version.id,
          },
        });
      }

      await tx.workflow.update({
        where: { id: workflowId },
        data: { status: 'published' },
      });

      return { app };
    });

    const publicAppId = result.app.appId;

    let apiKey: string | undefined;
    const adminOk = !!this.config.get<string>('ADMIN_API_SECRET')?.trim();
    const autoEmbed = this.config.get<string>('PUBLISH_AUTO_EMBED_API_KEY');
    const autoEmbedOn =
      adminOk && autoEmbed !== 'false' && autoEmbed !== '0' && autoEmbed !== 'off';
    if (autoEmbedOn) {
      const created = await this.appApiKeyService.createApiKeyForPublicApp(
        publicAppId,
        `发布 v${nextVersion}`,
      );
      apiKey = created.apiKey;
    }

    return { appId: publicAppId, ...(apiKey ? { apiKey } : {}) };
  }

  async create(dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        projectId: dto.projectId ?? null,
        graph: dto.graph as object,
        variables: (dto.variables ?? []) as object,
      },
    });
  }

  async findAll(projectId?: string) {
    return this.prisma.workflow.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const w = await this.prisma.workflow.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Workflow not found');
    return w;
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    await this.findOne(id);
    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.graph != null && { graph: dto.graph as object }),
        ...(dto.variables !== undefined && { variables: dto.variables as object }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.workflow.delete({ where: { id } });
  }
}
