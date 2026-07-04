import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, ParseIntPipe, UploadedFile, UseInterceptors, BadRequestException, Request, Res } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { EmployeesService, CreateEmployeeDto, UpdateEmployeeDto, OffboardingDto } from './employees.service'

@UseGuards(AuthGuard('jwt'))
@Controller('employees')
export class EmployeesController {
  constructor(private service: EmployeesService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('employmentStatus') employmentStatus?: string,
    @Query('includeContracts') includeContracts?: string,
  ) {
    return this.service.findAll({
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
      search,
      employmentStatus,
      includeContracts: includeContracts === 'true',
    })
  }

  @Get('dashboard-stats')
  getDashboardStats() {
    return this.service.getDashboardStats()
  }

  @Get('import-template')
  async getImportTemplate(@Res() res: any) {
    const buffer = await this.service.generateImportTemplate()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-karyawan.xlsx"')
    res.send(buffer)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto)
  }

  @Post('bulk-import')
  bulkCreate(@Body() body: { employees: CreateEmployeeDto[] }) {
    return this.service.bulkCreate(body.employees)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto)
  }

  @Post(':id/offboarding')
  offboard(@Param('id', ParseIntPipe) id: number, @Body() dto: OffboardingDto, @Request() req: any) {
    return this.service.offboard(id, dto, req.user)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'photos'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `photo-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Hanya file gambar (jpg, png, webp) yang diizinkan'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }))
  uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File tidak ditemukan')
    const fotoKaryawan = `/uploads/photos/${file.filename}`
    return this.service.updatePhoto(id, fotoKaryawan)
  }
}
