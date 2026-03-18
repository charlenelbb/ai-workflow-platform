import { IsOptional, IsString, IsObject, IsArray } from 'class-validator';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  graph?: { nodes: unknown[]; edges: unknown[] };

  @IsOptional()
  @IsArray()
  variables?: unknown[];
}
