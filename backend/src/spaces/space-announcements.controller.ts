import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SpaceAnnouncementsService } from './space-announcements.service'
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/create-announcement.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('spaces/:spaceId/announcements')
export class SpaceAnnouncementsController {
  constructor(private readonly service: SpaceAnnouncementsService) {}

  @Get()
  findAll(@Param('spaceId', ParseIntPipe) spaceId: number, @Request() req: any) {
    return this.service.findAll(spaceId, req.user.sub)
  }

  @Post()
  create(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Body() dto: CreateAnnouncementDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.create(spaceId, dto, req.user.sub, name)
  }

  @Put(':annId')
  update(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('annId', ParseIntPipe) annId: number,
    @Body() dto: UpdateAnnouncementDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.update(spaceId, annId, dto, req.user.sub, name)
  }

  @Delete(':annId')
  remove(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('annId', ParseIntPipe) annId: number,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.remove(spaceId, annId, req.user.sub, name)
  }
}
