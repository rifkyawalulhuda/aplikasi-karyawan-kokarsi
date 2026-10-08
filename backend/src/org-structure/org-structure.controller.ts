import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, ParseIntPipe, ForbiddenException, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import {
  OrgStructureService, CreateOrgPeriodDto, CreateOrgPositionDto, MoveOrgPositionDto,
} from './org-structure.service'
import { validateImageBuffer } from '../shared/file-validation.util'

@UseGuards(AuthGuard('jwt'))
@Controller('org-structure')
export class OrgStructureController {
  constructor(private service: OrgStructureService) {}

  private ensureWriteAccess(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Hanya ADMIN yang dapat mengubah struktur organisasi')
    }
  }

  private actor(req: any) {
    return { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' }
  }

  // ── Periods ──────────────────────────────────────────────────────────────
  @Get('periods')
  findPeriods() {
    return this.service.findAllPeriods()
  }

  @Post('periods')
  createPeriod(@Body() dto: CreateOrgPeriodDto, @Request() req: any) {
    this.ensureWriteAccess(req.user?.role)
    return this.service.createPeriod(dto, this.actor(req))
  }

  @Put('periods/:id')
  updatePeriod(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateOrgPeriodDto, @Request() req: any) {
    this.ensureWriteAccess(req.user?.role)
    return this.service.updatePeriod(id, dto, this.actor(req))
  }

  @Delete('periods/:id')
  removePeriod(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    this.ensureWriteAccess(req.user?.role)
    return this.service.removePeriod(id, this.actor(req))
  }

  // ── Nodes ────────────────────────────────────────────────────────────────
  @Get('tree')
  getTree(@Query('periodId', ParseIntPipe) periodId: number) {
    return this.service.getTree(periodId)
  }

  @Get('nodes')
  findNodes(@Query('periodId', ParseIntPipe) periodId: number) {
    return this.service.findAllNodes(periodId)
  }

  @Get('nodes/:id')
  findNode(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneNode(id)
  }

  @Post('nodes')
  createNode(@Body() dto: CreateOrgPositionDto, @Request() req: any) {
    this.ensureWriteAccess(req.user?.role)
    return this.service.createNode(dto, this.actor(req))
  }

  @Put('nodes/:id')
  updateNode(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateOrgPositionDto, @Request() req: any) {
    this.ensureWriteAccess(req.user?.role)
    return this.service.updateNode(id, dto, this.actor(req))
  }

  @Post('nodes/:id/move')
  moveNode(@Param('id', ParseIntPipe) id: number, @Body() dto: MoveOrgPositionDto, @Request() req: any) {
    this.ensureWriteAccess(req.user?.role)
    return this.service.moveNode(id, dto, this.actor(req))
  }

  @Delete('nodes/:id')
  removeNode(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    this.ensureWriteAccess(req.user?.role)
    return this.service.removeNode(id, this.actor(req))
  }

  @Post('nodes/:id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'org-structure'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `org-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Hanya file gambar (jpg, png, webp) yang diizinkan'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  async uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File tidak ditemukan')
    const buf = readFileSync(file.path)
    try {
      await validateImageBuffer(buf)
    } catch (err) {
      unlinkSync(file.path)
      throw err
    }
    const photoUrl = `/uploads/org-structure/${file.filename}`
    return this.service.updatePhoto(id, photoUrl)
  }
}
