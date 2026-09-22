import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import { validateImageBuffer, validatePdfBuffer } from '../shared/file-validation.util'
import { CreateGeneralArchiveDto, GeneralArchivesService } from './general-archives.service'

@UseGuards(AuthGuard('jwt'))
@Controller('general-archives')
export class GeneralArchivesController {
  constructor(private readonly service: GeneralArchivesService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.service.findAll({ page: page ? +page : 1, limit: limit ? +limit : 15, search })
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id) }

  @Post()
  create(@Body() dto: CreateGeneralArchiveDto, @Request() req: any) { return this.service.create(dto, this.actor(req)) }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateGeneralArchiveDto, @Request() req: any) { return this.service.update(id, dto, this.actor(req)) }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) { return this.service.remove(id, this.actor(req)) }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'general-archives'),
      filename: (_req, file, cb) => cb(null, `archive-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|pdf)$/)) return cb(new BadRequestException('Hanya file PDF atau gambar yang diizinkan'), false)
      cb(null, true)
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadFile(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File tidak ditemukan')
    const buffer = readFileSync(file.path)
    try {
      if (file.mimetype === 'application/pdf') await validatePdfBuffer(buffer)
      else await validateImageBuffer(buffer)
    } catch (error) {
      unlinkSync(file.path)
      throw error
    }
    return this.service.updateFileUrl(id, `/uploads/general-archives/${file.filename}`)
  }

  private actor(req: any) { return { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' } }
}
