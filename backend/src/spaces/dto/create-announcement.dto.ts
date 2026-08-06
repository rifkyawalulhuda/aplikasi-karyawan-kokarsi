import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class CreateAnnouncementDto {
  @IsString()
  content: string

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean
}
