import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

const SPACE_COLORS = ['blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo', 'gray', 'slate'] as const
const COLUMN_TEMPLATES = ['simple', 'dev', 'bug', 'hr', 'custom'] as const

export class CreateSpaceDto {
  @IsString()
  @MaxLength(255)
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string

  @IsIn(SPACE_COLORS)
  @IsOptional()
  color?: string

  @IsIn(COLUMN_TEMPLATES)
  @IsOptional()
  template?: string

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  memberIds?: number[]
}
