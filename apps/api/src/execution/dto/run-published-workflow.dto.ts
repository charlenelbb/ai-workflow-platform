import { IsObject, IsOptional } from 'class-validator';

export class RunPublishedWorkflowDto {
  @IsOptional()
  @IsObject()
  inputs?: Record<string, unknown>;

  /**
   * 为了兼容用户/前端可能的命名习惯，也允许使用 `input`。
   * Controller 内会做同等处理。
   */
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}

