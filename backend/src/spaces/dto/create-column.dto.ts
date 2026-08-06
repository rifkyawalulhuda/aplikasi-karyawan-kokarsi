import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

const COLUMN_COLORS = ['gray', 'blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo', 'slate'] as const

export class CreateColumnDto {
  @IsString()
  @MaxLength(100)
  name: string

  @IsIn(COLUMN_COLORS)
  @IsOptional()
  color?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number
}

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsIn(COLUMN_COLORS)
  @IsOptional()
  color?: string
}

export class ReorderColumnsDto {
  @IsArray()
  @IsInt({ each: true })
  columnIds: number[]
}
