import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, ParseIntPipe, Request, ForbiddenException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { LookupsService, CreateDocumentTypeDto } from './lookups.service'
import { IsNotEmpty, IsString } from 'class-validator'

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
  getDocumentTypes() {
    return this.service.getDocumentTypes()
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
}
