import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { SpaceDocumentsService } from './space-documents.service'
import { CreateDocumentDto, UpdateDocumentDto } from './dto/create-document.dto'
import { validateImageOrSvgBuffer } from '../shared/file-validation.util'

function ensureUploadDir() {
  const dir = join(process.cwd(), 'uploads', 'documents')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

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

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `doc-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml|avif|bmp|tiff)$/)) {
        return cb(new BadRequestException('Hanya file gambar (jpg, png, gif, webp, svg, avif, bmp, tiff) yang diizinkan'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadImage(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('File gambar tidak ditemukan')

    // Validasi magic bytes (bukan hanya MIME header)
    const { readFileSync, unlinkSync } = require('fs')
    const fileBuffer = readFileSync(file.path)
    try {
      await validateImageOrSvgBuffer(fileBuffer)
    } catch (err: any) {
      unlinkSync(file.path)
      throw new BadRequestException(err?.message ?? 'File gambar tidak valid')
    }

    const url = `/uploads/documents/${file.filename}`
    return { url }
  }
}
