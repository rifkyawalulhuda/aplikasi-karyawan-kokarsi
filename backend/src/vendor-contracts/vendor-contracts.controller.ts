import {
  Controller, Get, Post, Put, Delete, Param, Body,
  Query, UseGuards, ParseIntPipe, UseInterceptors,
  UploadedFile, BadRequestException, Request,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import { VendorContractsService, CreateVendorContractDto } from './vendor-contracts.service'
import { validateImageBuffer, validatePdfBuffer } from '../shared/file-validation.util'
import { VendorContractCategory } from '@prisma/client'

@UseGuards(AuthGuard('jwt'))
@Controller('vendor-contracts')
export class VendorContractsController {
  constructor(private service: VendorContractsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
      search,
      category,
      status,
      companyId: companyId ? +companyId : undefined,
    })
  }

  // MUST be before :id to avoid route conflict
  @Get('mother-agreements')
  findMotherAgreements(
    @Query('companyId') companyId: string,
    @Query('category') category: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.service.findMotherAgreements(
      +companyId,
      category as VendorContractCategory,
      excludeId ? +excludeId : undefined,
    )
  }

  // MUST be before :id to avoid route conflict
  @Post(':id/renew')
  renewContract(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateVendorContractDto) {
    return this.service.renewContract(id, dto)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateVendorContractDto, @Request() req: any) {
    return this.service.create(dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateVendorContractDto, @Request() req: any) {
    return this.service.update(id, dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.remove(id, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'vendor-contracts'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `vc-${unique}${extname(file.originalname)}`)
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
    const fileUrl = `/uploads/vendor-contracts/${file.filename}`
    return this.service.updateFileUrl(id, fileUrl)
  }
}
