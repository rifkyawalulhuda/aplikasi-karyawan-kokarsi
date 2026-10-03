import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  Res,
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

  /**
   * Field dinamis yang perlu diisi user saat membuat/memperpanjang kontrak.
   * Dipakai `AddContractModal` / `EditContractModal` / `RenewContractModal`.
   * Response menyertakan `published` agar modal bisa memblokir template yang
   * belum punya versi terbit (kontraknya akan kehilangan field dinamis).
   */
  @Get('contract-templates/:templateId/fields')
  getContractInputFields(@Param('templateId', ParseIntPipe) templateId: number) {
    return this.service.getContractInputFields(templateId)
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

  /**
   * Pratinjau PDF asli (1:1 dengan hasil generate). Mengembalikan berkas
   * `application/pdf`, bukan JSON — jadi memakai `@Res()` langsung.
   *
   * `contentDefinition` opsional di body: dipakai agar editan yang BELUM
   * disimpan ikut terlihat. Tanpa payload, versi tersimpan yang dirender.
   */
  @Post('contract-template-versions/:versionId/preview-pdf')
  async previewPdf(
    @Request() req: any,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() dto: Partial<VersionContentDto>,
    @Res() res: any,
  ) {
    this.ensureAdmin(req.user?.role)
    const buffer = await this.service.renderPreviewPdf(versionId, {
      contentDefinition: dto?.contentDefinition,
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="preview-template.pdf"')
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Post('contract-template-versions/:versionId/rollback')
  rollback(@Request() req: any, @Param('versionId', ParseIntPipe) versionId: number) {
    this.ensureAdmin(req.user?.role)
    return this.service.rollback(versionId, { name: req.user?.username ?? 'unknown' })
  }

  /**
   * Hapus versi ARCHIVED/DRAFT. PUBLISHED dan versi yang dipakai kontrak ditolak
   * di service dengan pesan jelas.
   */
  @Delete('contract-template-versions/:versionId')
  removeVersion(@Request() req: any, @Param('versionId', ParseIntPipe) versionId: number) {
    this.ensureAdmin(req.user?.role)
    return this.service.deleteVersion(versionId, { name: req.user?.username ?? 'unknown' })
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
