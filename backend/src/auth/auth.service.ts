import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt')

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateAdmin(employeeNo: string, password: string) {
    const admin = await this.prisma.masterAdmin.findUnique({
      where: { employeeNo },
    })
    if (!admin) throw new UnauthorizedException('Kredensial tidak valid')
    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) throw new UnauthorizedException('Kredensial tidak valid')
    return admin
  }

  async login(admin: any) {
    const payload = { sub: admin.id, employeeNo: admin.employeeNo, fullName: admin.fullName }
    return {
      access_token: this.jwt.sign(payload),
      admin: { id: admin.id, employeeNo: admin.employeeNo, fullName: admin.fullName },
    }
  }

  async changePassword(adminId: number, oldPassword: string, newPassword: string) {
    const admin = await this.prisma.masterAdmin.findUnique({ where: { id: adminId } })
    if (!admin) throw new UnauthorizedException('Admin tidak ditemukan')
    const valid = await bcrypt.compare(oldPassword, admin.password)
    if (!valid) throw new UnauthorizedException('Password lama salah')
    const hashed = await bcrypt.hash(newPassword, 10)
    await this.prisma.masterAdmin.update({ where: { id: adminId }, data: { password: hashed } })
    return { message: 'Password berhasil diubah' }
  }
}
