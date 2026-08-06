import {
  Body, Controller, Delete, Param, ParseIntPipe, Post, Put, Request, UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SpaceColumnsService } from './space-columns.service'
import { CreateColumnDto, ReorderColumnsDto, UpdateColumnDto } from './dto/create-column.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('spaces/:spaceId/columns')
export class SpaceColumnsController {
  constructor(private readonly service: SpaceColumnsService) {}

  @Post()
  create(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Body() dto: CreateColumnDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.create(spaceId, dto, req.user.sub, name)
  }

  @Post('reorder')
  reorder(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Body() dto: ReorderColumnsDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.reorder(spaceId, dto, req.user.sub, name)
  }

  @Put(':colId')
  update(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('colId', ParseIntPipe) colId: number,
    @Body() dto: UpdateColumnDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.update(spaceId, colId, dto, req.user.sub, name)
  }

  @Delete(':colId')
  remove(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('colId', ParseIntPipe) colId: number,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.remove(spaceId, colId, req.user.sub, name)
  }
}
