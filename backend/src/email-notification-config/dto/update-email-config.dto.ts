import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

export class ExternalEmailRecipientDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255)
  email: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string
}

export class UpdateEmailConfigDto {
  @IsBoolean()
  isEnabled: boolean

  @IsArray()
  @IsInt({ each: true })
  triggerWindows: number[]

  @IsArray()
  @IsInt({ each: true })
  recipientUserIds: number[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ExternalEmailRecipientDto)
  externalRecipients?: ExternalEmailRecipientDto[]
}

export class TestEmailDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ExternalEmailRecipientDto)
  recipients: ExternalEmailRecipientDto[]
}
