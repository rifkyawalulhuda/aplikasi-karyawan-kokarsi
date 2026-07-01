import { Controller, Post, Body, UseGuards, Request, Put } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthGuard } from '@nestjs/passport'
import { IsString, MinLength } from 'class-validator'

class LoginDto {
  @IsString() employeeNo: string
  @IsString() password: string
}

class ChangePasswordDto {
  @IsString() oldPassword: string
  @IsString() @MinLength(6) newPassword: string
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

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
}
