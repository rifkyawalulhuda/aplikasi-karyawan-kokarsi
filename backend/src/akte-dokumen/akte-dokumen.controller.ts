import {
  Controller, Get, Post, Put, Delete, Param, Body,
  Query, UseGuards, ParseIntPipe, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import { AkteDokumenService, CreateAkteDokumenDto, UpdateAkteDokumenDto } from './akte-dokumen.service'
import { validateImageBuffer, validatePdfBuffer } from '../shared/file-validation.util'

@UseGuards(AuthGuard('jwt'))
@Controller('akte-dokumen')
export class AkteDokumenController {
  constructor(private service: AkteDokumenService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
      search,
    })
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateAkteDokumenDto) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAkteDokumenDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'akte-dokumen'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `akte-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|pdf)$/)) {
        return cb(new BadRequestException('Hanya file PDF atau gambar yang diizinkan'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File tidak ditemukan')
    const buf = readFileSync(file.path)
    try {
      if (file.mimetype === 'application/pdf') await validatePdfBuffer(buf)
      else await validateImageBuffer(buf)
    } catch (err) {
      unlinkSync(file.path)
      throw err
    }
    const fileUrl = `/uploads/akte-dokumen/${file.filename}`
    return this.service.updateFileUrl(id, fileUrl)
  }
}
