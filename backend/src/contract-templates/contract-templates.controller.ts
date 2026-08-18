import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator'
import { ContractFamily } from '@prisma/client'
import { ContractTemplatesService } from './contract-templates.service'

class UpsertContractTemplateDto {
  @IsString()
  code: string

  @IsString()
  name: string

  @IsEnum(ContractFamily)
  family: ContractFamily

  @IsString()
  templateKey: string

  @IsOptional()
  @IsInt()
  contractTypeId?: number

  @IsOptional()
  @IsInt()
  jobRoleId?: number

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  // Flexible JSON metadata for template-specific requirements.
  requiredFields?: unknown

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  version?: number

  @IsOptional()
  @IsString()
  notes?: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('contract-templates')
export class ContractTemplatesController {
  constructor(private readonly service: ContractTemplatesService) {}

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAll({ activeOnly: activeOnly === 'true' })
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Request() req: any, @Body() dto: UpsertContractTemplateDto) {
    this.service.ensureAdmin(req.user?.role)
    return this.service.create(dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Put(':id')
  update(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpsertContractTemplateDto) {
    this.service.ensureAdmin(req.user?.role)
    return this.service.update(id, dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Get(':id/content-preview')
  getContentPreview(@Param('id', ParseIntPipe) id: number) {
    return this.service.getContentPreview(id)
  }

  @Put(':id/content-overrides')
  updateContentOverrides(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { overrides: Record<string, any> },
  ) {
    this.service.ensureAdmin(req.user?.role)
    return this.service.updateContentOverrides(id, body.overrides)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.service.ensureAdmin(req.user?.role)
    return this.service.remove(id, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }
}
