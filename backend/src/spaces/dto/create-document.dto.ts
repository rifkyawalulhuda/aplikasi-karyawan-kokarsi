import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateDocumentDto {
  @IsString()
  @MaxLength(255)
  title: string

  @IsString()
  content: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  emoji?: string
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  emoji?: string
}
