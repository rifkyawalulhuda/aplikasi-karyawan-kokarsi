import { Controller, Post, Body, UseGuards, Request, Put, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthGuard } from '@nestjs/passport'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { IsString, MinLength } from 'class-validator'
import { validateImageOrSvgBuffer } from '../shared/file-validation.util'

class LoginDto {
  @IsString() employeeNo: string
  @IsString() password: string
}

class ChangePasswordDto {
  @IsString() oldPassword: string
  @IsString() @MinLength(6) newPassword: string
}

function profilePhotoDir() {
  const dir = join(process.cwd(), 'uploads', 'profile-photos')
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs')
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

@SkipThrottle()
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const admin = await this.auth.validateAdmin(dto.employeeNo, dto.password)
    return this.auth.login(admin)
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('change-password')
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    if (req.user.kind === 'user_account') {
      return this.auth.changeUserPassword(req.user.sub, dto.oldPassword, dto.newPassword)
    }
    return this.auth.changePassword(req.user.sub, dto.oldPassword, dto.newPassword)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('profile/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, profilePhotoDir()),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, `profile-${unique}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|svg\+xml|avif|bmp|tiff)$/)) {
        return cb(new BadRequestException('Hanya file gambar (jpg, png, webp, svg, avif, bmp, tiff) yang diizinkan'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  async uploadProfilePhoto(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File foto tidak ditemukan')

    const { readFileSync } = require('fs')
    const fileBuffer = readFileSync(file.path)
    try {
      await validateImageOrSvgBuffer(fileBuffer)
    } catch (err: any) {
      unlinkSync(file.path)
      throw new BadRequestException(err?.message ?? 'File gambar tidak valid')
    }

    const photoUrl = `/uploads/profile-photos/${file.filename}`
    await this.auth.updateProfilePhoto(req.user.sub, req.user.kind, photoUrl)
    return { photoUrl }
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('profile/photo')
  async deleteProfilePhoto(@Request() req: any) {
    const previousUrl = await this.auth.getProfilePhoto(req.user.sub, req.user.kind)
    if (previousUrl) {
      const filePath = join(process.cwd(), previousUrl.replace(/^\//, ''))
      if (existsSync(filePath)) {
        try { unlinkSync(filePath) } catch { /* non-fatal */ }
      }
    }
    await this.auth.clearProfilePhoto(req.user.sub, req.user.kind)
    return { deleted: true }
  }
}
