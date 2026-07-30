import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { EmailNotificationConfigService } from './email-notification-config.service'
import { UpdateEmailConfigDto } from './dto/update-email-config.dto'

@Controller('email-notification-config')
export class EmailNotificationConfigController {
  constructor(private readonly service: EmailNotificationConfigService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getConfig() {
    return this.service.getConfig()
  }

  @Put()
  @UseGuards(AuthGuard('jwt'))
  async updateConfig(@Body() dto: UpdateEmailConfigDto, @Request() req: any) {
    const role = req.user?.role
    const username = req.user?.username ?? req.user?.name ?? 'unknown'
    return this.service.updateConfig(dto, username, role)
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'))
  async getUsers() {
    return this.service.getAllUsers()
  }
}
