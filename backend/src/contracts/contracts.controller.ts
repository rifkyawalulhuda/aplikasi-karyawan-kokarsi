import { BadRequestException, Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, ParseIntPipe, Res, UseInterceptors, UploadedFile } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { join, extname } from 'path'
import { ContractsService, CreateContractDto, UpdateContractDto, RenewContractDto } from './contracts.service'
import { ContractDocumentService } from './contract-document.service'

@UseGuards(AuthGuard('jwt'))
@Controller('contracts')
export class ContractsController {
  constructor(
    private service: ContractsService,
    private contractDocumentService: ContractDocumentService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
      status,
      employeeId: employeeId ? +employeeId : undefined,
    })
  }

  @Get('summary')
  findSummary() {
    return this.service.findSummary()
  }

  @Get('history/:employeeId')
  findHistoryByEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.findHistoryByEmployee(employeeId)
  }

  @Get('expiring')
  getExpiring(@Query('days') days?: string) {
    return this.service.getExpiring(days ? +days : 30)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Get(':id/document-preview')
  documentPreview(@Param('id', ParseIntPipe) id: number) {
    return this.contractDocumentService.preview(id)
  }

  @Post(':id/generate-document')
  generateDocument(@Param('id', ParseIntPipe) id: number) {
    return this.contractDocumentService.generate(id)
  }

  @Get(':id/download-pdf')
  async downloadPdf(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const { join } = require('path')
    const { readFileSync, existsSync } = require('fs')

    const result = await this.contractDocumentService.generate(id)
    const target = result.generatedPdfUrl
    if (!target) {
      throw new BadRequestException('PDF belum tersedia. Coba generate ulang dokumen kontrak.')
    }
    const filePath = join(process.cwd(), target)
    if (!existsSync(filePath)) {
      throw new BadRequestException('File PDF tidak ditemukan di server.')
    }
    const pdfBuffer = readFileSync(filePath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="contract.pdf"')
    res.send(pdfBuffer)
  }

  @Post()
  create(@Body() dto: CreateContractDto) {
    return this.service.create(dto)
  }

  @Post(':id/renew')
  renew(@Param('id', ParseIntPipe) id: number, @Body() dto: RenewContractDto) {
    return this.service.renew(id, dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContractDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }

  @Post(':id/document')
  @UseInterceptors(FileInterceptor('document', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'contracts', 'scanned'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `contract-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        return cb(new BadRequestException('Hanya file PDF yang diizinkan'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File tidak ditemukan')
    const documentUrl = `/uploads/contracts/scanned/${file.filename}`
    return this.service.updateDocumentUrl(id, documentUrl)
  }
}
