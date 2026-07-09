import { Controller, Get, Post, Put, Delete, Param, Body, Query, Res, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import { WarningLettersService, CreateWarningLetterDto, UpdateWarningLetterDto } from './warning-letters.service'
import { PdfGeneratorService } from './pdf-generator.service'
import { validateImageBuffer, validatePdfBuffer } from '../shared/file-validation.util'

@UseGuards(AuthGuard('jwt'))
@Controller('warning-letters')
export class WarningLettersController {
  constructor(
    private service: WarningLettersService,
    private pdfGenerator: PdfGeneratorService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(
      page ? +page : 1,
      limit ? +limit : 10,
      search,
    )
  }

  @Get('escalation/:employeeId')
  getEscalationStatus(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.getEscalationStatus(employeeId)
  }

  @Get('preview-number')
  async previewLetterNumber(@Query('letterDate') letterDate?: string) {
    const ref = letterDate ? new Date(letterDate) : new Date()
    return { letterNumber: await this.service.generateLetterNumber(ref) }
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Get(':id/generate')
  async generate(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const letter = await this.service.findOne(id)
    const buffer = await this.pdfGenerator.generateWarningLetter(letter)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="SP-${letter.letterNumber}.pdf"`)
    res.send(buffer)
  }

  @Get(':id/preview')
  async preview(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const letter = await this.service.findOne(id)
    const buffer = await this.pdfGenerator.generateWarningLetter(letter)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="SP-${letter.letterNumber}.pdf"`)
    res.send(buffer)
  }

  @Post()
  create(@Body() dto: CreateWarningLetterDto) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWarningLetterDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'warning-letters'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `sp-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|pdf)$/)) {
        return cb(new BadRequestException('Hanya file PDF atau gambar (JPG, PNG, WEBP) yang diizinkan'), false)
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
      if (file.mimetype === 'application/pdf') {
        await validatePdfBuffer(buf)
      } else {
        await validateImageBuffer(buf)
      }
    } catch (err) {
      unlinkSync(file.path)
      throw err
    }
    const documentUrl = `/uploads/warning-letters/${file.filename}`
    return this.service.updateFileUrl(id, documentUrl)
  }
}
