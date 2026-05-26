import { IsOptional, IsString } from 'class-validator';

export class PingDto {
  @IsOptional()
  @IsString()
  message?: string;
}
