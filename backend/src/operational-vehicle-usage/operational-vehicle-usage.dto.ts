import { IsDateString, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export const OPERATIONAL_VEHICLES = ['Xenia B 2845 FON', 'Grand max B 9043 FCM'] as const

export class CreateOperationalVehicleUsageDto {
  @IsDateString()
  usedAt: string

  @IsString()
  @IsIn(OPERATIONAL_VEHICLES)
  vehicleNumber: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  driver: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  destination: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  user: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  requester: string
}
