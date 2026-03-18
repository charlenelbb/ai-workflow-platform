import { IsString, IsOptional, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NodeDto {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

class EdgeDto {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

class GraphDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  nodes: NodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  edges: EdgeDto[];
}

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => GraphDto)
  graph: GraphDto;

  @IsOptional()
  @IsArray()
  variables?: unknown[];
}
