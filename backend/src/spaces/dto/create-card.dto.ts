import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

const PRIORITIES = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

export class CreateCardDto {
  @IsString()
  @MaxLength(255)
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsIn(PRIORITIES)
  @IsOptional()
  priority?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  assigneeIds?: number[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[]

  @IsOptional()
  @IsString()
  coverColor?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number
}

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsIn(PRIORITIES)
  @IsOptional()
  priority?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string | null

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  assigneeIds?: number[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[]

  @IsOptional()
  @IsString()
  coverColor?: string | null
}

export class MoveCardDto {
  @IsInt()
  @Min(1)
  toColumnId: number

  @IsInt()
  @Min(0)
  position: number
}
