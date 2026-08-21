import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
  Request,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import { EmployeeDocumentsService, CreateEmployeeDocumentDto, UpdateEmployeeDocumentDto } from './employee-documents.service'
import { validateImageBuffer, validatePdfBuffer } from '../shared/file-validation.util'

@UseGuards(AuthGuard('jwt'))
@Controller('employee-documents')
export class EmployeeDocumentsController {
  constructor(private service: EmployeeDocumentsService) {}

  @Get('summary')
  findSummary(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findEmployeeSummary({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      status,
    })
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Query('documentTypeCategory') documentTypeCategory?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      status,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      documentTypeCategory,
    })
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateEmployeeDocumentDto, @Request() req: any) {
    return this.service.create(dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDocumentDto, @Request() req: any) {
    return this.service.update(id, dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.remove(id, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'employee-docs'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `doc-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|pdf)$/)) {
        return cb(
          new BadRequestException('Hanya file PDF, JPG, PNG, atau WEBP yang diizinkan'),
          false,
        )
      }
      cb(null, true)
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  async uploadFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File tidak ditemukan')

    // diskStorage tidak isi file.buffer — baca dari disk untuk validasi magic bytes
    const fileBuffer = readFileSync(file.path)
    try {
      if (file.mimetype === 'application/pdf') {
        await validatePdfBuffer(fileBuffer)
      } else {
        await validateImageBuffer(fileBuffer)
      }
    } catch (err) {
      // Hapus file yang tidak valid dari disk
      unlinkSync(file.path)
      throw err
    }

    const fileUrl = `/uploads/employee-docs/${file.filename}`
    return this.service.updateFileUrl(id, fileUrl)
  }
}
