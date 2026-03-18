import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

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
