import { Body, Controller, Get, Param, Post, Put, Request, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { IsString, MinLength, IsOptional } from 'class-validator'
import { extname, join } from 'path'
import { SettingsService } from './settings.service'

class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  cooperativeChairmanName?: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  organizationName?: string

  @IsOptional()
  @IsString()
  loginLeftBgColor?: string

  @IsOptional()
  @IsString()
  loginRightBgColor?: string

  @IsOptional()
  @IsString()
  loginLeftImageUrl?: string

  @IsOptional()
  @IsString()
  loginRightImageUrl?: string

  @IsOptional()
  @IsString()
  loginLeftOverlayOpacity?: string

  @IsOptional()
  @IsString()
  loginRightOverlayOpacity?: string

  @IsOptional()
  @IsString()
  loginLeftTextColor?: string

  @IsOptional()
  @IsString()
  loginRightTextColor?: string
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('general')
  getGeneralSettings() {
    return this.settingsService.getGeneralSettings()
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('general')
  updateGeneralSettings(@Request() req: any, @Body() dto: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneralSettings(dto, req.user?.role)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logo')
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'settings'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `logo-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|svg\+xml)$/)) {
        return cb(new BadRequestException('Hanya file gambar (jpg, png, webp, svg) yang diizinkan'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  uploadLogo(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File tidak ditemukan')
    const logoUrl = `/uploads/settings/${file.filename}`
    return this.settingsService.updateLogo(logoUrl, req.user?.role)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('login-image/:side')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'settings'),
      filename: (req, file, cb) => {
        const side = (req.params as any).side
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `login-${side}-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Only image files allowed'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadLoginImage(
    @Request() req: any,
    @Param('side') side: 'left' | 'right',
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File tidak ditemukan')
    return this.settingsService.updateLoginImage(side, '/uploads/settings/' + file.filename, req.user?.role)
  }
}
