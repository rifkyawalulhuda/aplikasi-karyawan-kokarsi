import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator'
import { ContractTemplateVersionsService } from './contract-template-versions.service'

class VersionContentDto {
  @IsOptional()
  @IsObject()
  contentDefinition?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  overrides?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  fieldDefinitions?: unknown[]

  @IsOptional()
  @IsString()
  changeSummary?: string
}

@UseGuards(AuthGuard('jwt'))
@Controller()
export class ContractTemplateVersionsController {
  constructor(private service: ContractTemplateVersionsService) {}

  @Get('contract-templates/:templateId/versions')
  listVersions(@Param('templateId', ParseIntPipe) templateId: number) {
    return this.service.listVersions(templateId)
  }

  @Post('contract-templates/:templateId/versions')
  createDraft(
    @Request() req: any,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: VersionContentDto,
  ) {
    this.ensureAdmin(req.user?.role)
    return this.service.createDraft(templateId, dto, { name: req.user?.username ?? 'unknown' })
  }

  @Get('contract-template-versions/:versionId')
  findOne(@Param('versionId', ParseIntPipe) versionId: number) {
    return this.service.findOne(versionId)
  }

  @Put('contract-template-versions/:versionId')
  updateDraft(
    @Request() req: any,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() dto: Partial<VersionContentDto>,
  ) {
    this.ensureAdmin(req.user?.role)
    return this.service.updateDraft(versionId, dto, { name: req.user?.username ?? 'unknown' })
  }

  @Post('contract-template-versions/:versionId/publish')
  publish(@Request() req: any, @Param('versionId', ParseIntPipe) versionId: number) {
    this.ensureAdmin(req.user?.role)
    return this.service.publish(versionId, { name: req.user?.username ?? 'unknown' })
  }

  @Post('contract-template-versions/:versionId/preview')
  preview(@Request() req: any, @Param('versionId', ParseIntPipe) versionId: number) {
    this.ensureAdmin(req.user?.role)
    return this.service.preview(versionId)
  }

  @Post('contract-template-versions/:versionId/rollback')
  rollback(@Request() req: any, @Param('versionId', ParseIntPipe) versionId: number) {
    this.ensureAdmin(req.user?.role)
    return this.service.rollback(versionId, { name: req.user?.username ?? 'unknown' })
  }

  @Get('contract-templates/:templateId/versions/published')
  getPublished(@Param('templateId', ParseIntPipe) templateId: number) {
    return this.service.getPublished(templateId)
  }

  private ensureAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Role tidak diizinkan')
    }
  }
}
