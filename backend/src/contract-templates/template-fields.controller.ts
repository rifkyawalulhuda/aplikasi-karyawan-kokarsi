import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { TemplateFieldsService } from './template-fields.service'

@UseGuards(AuthGuard('jwt'))
@Controller('template-fields')
export class TemplateFieldsController {
  constructor(private service: TemplateFieldsService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll({ includeInactive: includeInactive === 'true' })
  }

  @Get('seed')
  seed() {
    return this.service.ensureSystemFields()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Request() req: any, @Body() dto: any) {
    this.ensureAdmin(req.user?.role)
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    this.ensureAdmin(req.user?.role)
    return this.service.update(id, dto)
  }

  @Put(':id/archive')
  archive(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureAdmin(req.user?.role)
    return this.service.archive(id)
  }

  private ensureAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Role Pengelola Koperasi tidak dapat mengubah katalog field')
    }
  }
}
