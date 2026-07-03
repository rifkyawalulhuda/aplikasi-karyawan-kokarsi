import { BadRequestException, Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, ParseIntPipe, Res } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ContractsService, CreateContractDto, UpdateContractDto } from './contracts.service'
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

    // First try serving existing generated PDF without re-generating
    const contract = await this.service.findOne(id)
    if (contract.generatedPdfUrl) {
      const existingPath = join(process.cwd(), contract.generatedPdfUrl)
      if (existsSync(existingPath)) {
        const pdfBuffer = readFileSync(existingPath)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', 'inline; filename="contract.pdf"')
        res.send(pdfBuffer)
        return
      }
    }

    // Otherwise generate fresh
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

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContractDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }
}
