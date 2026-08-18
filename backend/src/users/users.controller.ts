import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'
import { UsersService } from './users.service'

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  nik: string

  @IsEmail()
  email: string

  @IsIn(['ADMIN', 'PENGELOLA_KOPERASI'])
  role: 'ADMIN' | 'PENGELOLA_KOPERASI'

  @IsString()
  @IsNotEmpty()
  username: string

  @IsString()
  @MinLength(6)
  password: string
}

class UpdateUserDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  nik?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsIn(['ADMIN', 'PENGELOLA_KOPERASI'])
  role?: 'ADMIN' | 'PENGELOLA_KOPERASI'

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  username?: string

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  private ensureAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Role Pengelola Koperasi tidak dapat mengubah data User')
    }
  }

  @Get('pengurus')
  getPengurus() {
    return this.service.getAll()
  }

  @Get()
  getAll(@Request() req: any) {
    this.ensureAdmin(req.user?.role)
    return this.service.getAll()
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateUserDto) {
    this.ensureAdmin(req.user?.role)
    return this.service.create(dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Put(':id')
  update(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    this.ensureAdmin(req.user?.role)
    return this.service.update(id, dto, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    this.ensureAdmin(req.user?.role)
    return this.service.delete(id, { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' })
  }
}
