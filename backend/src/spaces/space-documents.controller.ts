import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SpaceDocumentsService } from './space-documents.service'
import { CreateDocumentDto, UpdateDocumentDto } from './dto/create-document.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('spaces/:spaceId/documents')
export class SpaceDocumentsController {
  constructor(private readonly service: SpaceDocumentsService) {}

  @Get()
  findAll(@Param('spaceId', ParseIntPipe) spaceId: number, @Request() req: any) {
    return this.service.findAll(spaceId, req.user.sub)
  }

  @Post()
  create(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Body() dto: CreateDocumentDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.create(spaceId, dto, req.user.sub, name)
  }

  @Get(':docId')
  findOne(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Request() req: any,
  ) {
    return this.service.findOne(spaceId, docId, req.user.sub)
  }

  @Put(':docId')
  update(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Body() dto: UpdateDocumentDto,
    @Request() req: any,
  ) {
    return this.service.update(spaceId, docId, dto, req.user.sub)
  }

  @Delete(':docId')
  remove(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Request() req: any,
  ) {
    return this.service.remove(spaceId, docId, req.user.sub)
  }
}
