import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PositionDto {
  @IsNumber()
  x!: number;
  @IsNumber()
  y!: number;
}

class NodeDto {
  @IsString()
  id!: string;
  @IsString()
  type!: string;
  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;
  @IsObject()
  data!: Record<string, unknown>;
  @IsOptional()
  @IsNumber()
  width?: number;
  @IsOptional()
  @IsNumber()
  height?: number;
}

class EdgeDto {
  @IsString()
  id!: string;
  @IsString()
  source!: string;
  @IsString()
  target!: string;
  @IsOptional()
  @IsString()
  sourceHandle?: string;
  @IsOptional()
  @IsString()
  targetHandle?: string;
}

class GraphDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes!: NodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges!: EdgeDto[];
}

export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => GraphDto)
  graph!: GraphDto;

  @IsOptional()
  @IsArray()
  variables?: unknown[];
}
