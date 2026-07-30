import { IsBoolean, IsArray, IsInt } from 'class-validator'

export class UpdateEmailConfigDto {
  @IsBoolean()
  isEnabled: boolean

  @IsArray()
  @IsInt({ each: true })
  triggerWindows: number[]

  @IsArray()
  @IsInt({ each: true })
  recipientUserIds: number[]
}
