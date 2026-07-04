import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { IsString, MinLength } from 'class-validator'
import { SettingsService } from './settings.service'

class UpdateGeneralSettingsDto {
  @IsString()
  @MinLength(3)
  cooperativeChairmanName: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('general')
  getGeneralSettings() {
    return this.settingsService.getGeneralSettings()
  }

  @Put('general')
  updateGeneralSettings(@Request() req: any, @Body() dto: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneralSettings(dto, req.user?.role)
  }
}
