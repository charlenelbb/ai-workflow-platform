import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;
}
