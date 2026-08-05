import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

const CALENDAR_COLORS = ['blue', 'sky', 'green', 'teal', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo', 'gray', 'slate'] as const

export class CalendarEventDto {
  @IsString()
  @MaxLength(255)
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string

  @IsDateString()
  startDate: string

  @IsDateString()
  endDate: string

  @IsString()
  startTime: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsIn(CALENDAR_COLORS)
  color: (typeof CALENDAR_COLORS)[number]

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  assignedUserIds?: number[]
}
