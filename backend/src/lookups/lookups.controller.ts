import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, ParseIntPipe, Request, ForbiddenException, UploadedFile, UseInterceptors, BadRequestException, Res, Query } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { LookupsService, CreateDocumentTypeDto, CreateCompanyDto } from './lookups.service'
import { IsNotEmpty, IsString } from 'class-validator'
import * as XLSX from 'xlsx'

class CreateLookupDto {
  @IsString()
  @IsNotEmpty()
  name: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('lookups')
export class LookupsController {
  constructor(private service: LookupsService) {}

  private ensureMasterDataWriteAccess(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Role Pengelola Koperasi tidak dapat mengubah Master Data')
    }
  }

  @Get()
  getAll() {
    return this.service.getAll()
  }

  @Get('work-locations')
  getWorkLocations() { return this.service.getWorkLocations() }

  @Post('work-locations')
  createWorkLocation(@Request() req: any, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createWorkLocation(dto.name)
  }

  @Put('work-locations/:id')
  updateWorkLocation(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateWorkLocation(id, dto.name)
  }

  @Delete('work-locations/:id')
  deleteWorkLocation(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteWorkLocation(id)
  }

  @Get('job-roles')
  getJobRoles() { return this.service.getJobRoles() }

  @Post('job-roles')
  createJobRole(@Request() req: any, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createJobRole(dto.name)
  }

  @Put('job-roles/:id')
  updateJobRole(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateJobRole(id, dto.name)
  }

  @Delete('job-roles/:id')
  deleteJobRole(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteJobRole(id)
  }

  @Get('job-levels')
  getJobLevels() { return this.service.getJobLevels() }

  @Post('job-levels')
  createJobLevel(@Request() req: any, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createJobLevel(dto.name)
  }

  @Put('job-levels/:id')
  updateJobLevel(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateJobLevel(id, dto.name)
  }

  @Delete('job-levels/:id')
  deleteJobLevel(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteJobLevel(id)
  }

  @Get('tax-status')
  getTaxStatus() { return this.service.getTaxStatus() }

  @Post('tax-status')
  createTaxStatus(@Request() req: any, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createTaxStatus(dto.name)
  }

  @Put('tax-status/:id')
  updateTaxStatus(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateTaxStatus(id, dto.name)
  }

  @Delete('tax-status/:id')
  deleteTaxStatus(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteTaxStatus(id)
  }

  @Get('departments')
  getDepartments() { return this.service.getDepartments() }

  @Post('departments')
  createDepartment(@Request() req: any, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createDepartment(dto.name)
  }

  @Put('departments/:id')
  updateDepartment(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateDepartment(id, dto.name)
  }

  @Delete('departments/:id')
  deleteDepartment(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteDepartment(id)
  }

  @Get('contract-types')
  getContractTypes() { return this.service.getContractTypes() }

  @Post('contract-types')
  createContractType(@Request() req: any, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createContractType(dto.name)
  }

  @Put('contract-types/:id')
  updateContractType(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateContractType(id, dto.name)
  }

  @Delete('contract-types/:id')
  deleteContractType(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteContractType(id)
  }

  @Get('document-types')
  getDocumentTypes(@Query('category') category?: string) {
    return this.service.getDocumentTypes(category)
  }

  @Post('document-types')
  createDocumentType(@Request() req: any, @Body() dto: CreateDocumentTypeDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createDocumentType(dto)
  }

  @Put('document-types/:id')
  updateDocumentType(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateDocumentTypeDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateDocumentType(id, dto)
  }

  @Delete('document-types/:id')
  deleteDocumentType(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteDocumentType(id)
  }

  // ── Company endpoints ────────────────────────────────────────────────
  @Get('companies')
  getCompanies() {
    return this.service.getCompanies()
  }

  @Get('companies/import-template')
  async importCompanyTemplate(@Res() res: any) {
    const buffer = await this.service.generateCompanyImportTemplate()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-perusahaan.xlsx"')
    res.send(buffer)
  }

  @Post('companies/bulk-import')
  @UseInterceptors(FileInterceptor('file'))
  async bulkImportCompanies(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File tidak ditemukan')

    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' })

    const companies: CreateCompanyDto[] = rows.map((row: any) => ({
      name: String(row['Nama Perusahaan'] ?? '').trim(),
      address: String(row['Alamat'] ?? '').trim() || undefined,
      email: String(row['Email'] ?? '').trim() || undefined,
      phone: String(row['No. Kontak'] ?? '').trim() || undefined,
    })).filter(c => c.name)

    if (companies.length === 0) {
      throw new BadRequestException('Tidak ada data valid di file. Pastikan kolom "Nama Perusahaan" terisi.')
    }

    return this.service.bulkCreateCompanies(companies)
  }

  @Post('companies')
  createCompany(@Request() req: any, @Body() dto: CreateCompanyDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.createCompany(dto)
  }

  @Put('companies/:id')
  updateCompany(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateCompanyDto) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.updateCompany(id, dto)
  }

  @Delete('companies/:id')
  deleteCompany(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureMasterDataWriteAccess(req.user?.role)
    return this.service.deleteCompany(id)
  }
}
