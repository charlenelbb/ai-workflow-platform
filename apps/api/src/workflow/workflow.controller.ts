import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowService.create(dto);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.workflowService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workflowService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflowService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workflowService.remove(id);
  }
}
