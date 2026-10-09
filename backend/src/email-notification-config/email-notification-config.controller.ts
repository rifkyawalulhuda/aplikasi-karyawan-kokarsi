import { Controller, Get, Post, Put, Body, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { EmailNotificationConfigService } from './email-notification-config.service'
import { TestEmailDto, UpdateEmailConfigDto } from './dto/update-email-config.dto'

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
    const username = req.user?.fullName ?? req.user?.employeeNo ?? req.user?.email ?? 'unknown'
    return this.service.updateConfig(dto, username, role)
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'))
  async getUsers() {
    return this.service.getAllUsers()
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async getStatus() {
    return this.service.getStatus()
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'))
  async getHistory() {
    return this.service.getHistory()
  }

  @Post('test')
  @UseGuards(AuthGuard('jwt'))
  async sendTestEmail(@Body() dto: TestEmailDto, @Request() req: any) {
    return this.service.sendTestEmail(dto, req.user?.role)
  }
}
