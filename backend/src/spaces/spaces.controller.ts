import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { IsInt } from 'class-validator'
import { Type } from 'class-transformer'
import { SpacesService } from './spaces.service'
import { CreateSpaceDto } from './dto/create-space.dto'

class AddMemberDto {
  @IsInt()
  @Type(() => Number)
  memberId: number
}

@UseGuards(AuthGuard('jwt'))
@Controller('spaces')
export class SpacesController {
  constructor(private readonly service: SpacesService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.sub)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.findOne(id, req.user.sub)
  }

  @Post()
  create(@Body() dto: CreateSpaceDto, @Request() req: any) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.create(dto, req.user.sub, name)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateSpaceDto>, @Request() req: any) {
    return this.service.update(id, dto, req.user.sub)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.remove(id, req.user.sub)
  }

  @Post(':id/members')
  addMember(@Param('id', ParseIntPipe) id: number, @Body() body: AddMemberDto, @Request() req: any) {
    const actorName = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.addMember(id, body.memberId, req.user.sub, actorName)
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    return this.service.removeMember(id, userId, req.user.sub)
  }
}
