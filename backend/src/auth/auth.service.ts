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

  private async compareOrThrow(password: string, hashedPassword: string) {
    const valid = await bcrypt.compare(password, hashedPassword)
    if (!valid) throw new UnauthorizedException('Kredensial tidak valid')
  }

  async validateAdmin(identifier: string, password: string) {
    const admin = await this.prisma.masterAdmin.findUnique({
      where: { employeeNo: identifier },
    })
    if (admin) {
      await this.compareOrThrow(password, admin.password)
      return { ...admin, accountType: 'master_admin' as const, email: '' }
    }

    const user = await this.prisma.userAccount.findFirst({
      where: {
        OR: [{ username: identifier }, { nik: identifier }],
      },
    })
    if (user) {
      await this.compareOrThrow(password, user.password)
      return { ...user, accountType: 'user_account' as const, email: user.email }
    }

    throw new UnauthorizedException('Kredensial tidak valid')
  }

  async login(admin: any) {
    const identifier = admin.employeeNo ?? admin.nik ?? admin.username
    const email = admin.email ?? ''
    const payload = { sub: admin.id, employeeNo: identifier, fullName: admin.fullName ?? admin.name, role: admin.role, accountType: admin.accountType, email }
    return {
      access_token: this.jwt.sign(payload),
      admin: { id: admin.id, employeeNo: identifier, fullName: admin.fullName ?? admin.name, role: admin.role, accountType: admin.accountType, email },
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

  async changeUserPassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException('User tidak ditemukan')
    await this.compareOrThrow(oldPassword, user.password)
    const hashed = await bcrypt.hash(newPassword, 10)
    await this.prisma.userAccount.update({ where: { id: userId }, data: { password: hashed } })
    return { message: 'Password berhasil diubah' }
  }
}
