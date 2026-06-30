import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { LookupsService } from './lookups.service'
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

  @Get()
  getAll() {
    return this.service.getAll()
  }

  @Get('work-locations')
  getWorkLocations() { return this.service.getWorkLocations() }

  @Post('work-locations')
  createWorkLocation(@Body() dto: CreateLookupDto) { return this.service.createWorkLocation(dto.name) }

  @Put('work-locations/:id')
  updateWorkLocation(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    return this.service.updateWorkLocation(id, dto.name)
  }

  @Delete('work-locations/:id')
  deleteWorkLocation(@Param('id', ParseIntPipe) id: number) { return this.service.deleteWorkLocation(id) }

  @Get('job-roles')
  getJobRoles() { return this.service.getJobRoles() }

  @Post('job-roles')
  createJobRole(@Body() dto: CreateLookupDto) { return this.service.createJobRole(dto.name) }

  @Put('job-roles/:id')
  updateJobRole(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    return this.service.updateJobRole(id, dto.name)
  }

  @Delete('job-roles/:id')
  deleteJobRole(@Param('id', ParseIntPipe) id: number) { return this.service.deleteJobRole(id) }

  @Get('job-levels')
  getJobLevels() { return this.service.getJobLevels() }

  @Post('job-levels')
  createJobLevel(@Body() dto: CreateLookupDto) { return this.service.createJobLevel(dto.name) }

  @Put('job-levels/:id')
  updateJobLevel(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    return this.service.updateJobLevel(id, dto.name)
  }

  @Delete('job-levels/:id')
  deleteJobLevel(@Param('id', ParseIntPipe) id: number) { return this.service.deleteJobLevel(id) }

  @Get('tax-status')
  getTaxStatus() { return this.service.getTaxStatus() }

  @Post('tax-status')
  createTaxStatus(@Body() dto: CreateLookupDto) { return this.service.createTaxStatus(dto.name) }

  @Put('tax-status/:id')
  updateTaxStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLookupDto) {
    return this.service.updateTaxStatus(id, dto.name)
  }

  @Delete('tax-status/:id')
  deleteTaxStatus(@Param('id', ParseIntPipe) id: number) { return this.service.deleteTaxStatus(id) }
}
