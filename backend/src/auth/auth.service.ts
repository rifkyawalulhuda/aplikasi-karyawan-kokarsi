import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt')

interface AuthenticatedUser {
  id: number
  employeeNo?: string
  nik?: string
  username?: string
  fullName?: string
  name?: string
  role: 'ADMIN' | 'PENGELOLA_KOPERASI'
  accountType: 'master_admin' | 'user_account'
  email?: string
  photoUrl?: string | null
  isActive?: boolean
  tokenVersion?: number
}

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
      if (admin.isActive === false) throw new UnauthorizedException('Kredensial tidak valid')
      await this.compareOrThrow(password, admin.password)
      return { ...admin, accountType: 'master_admin' as const, email: '' }
    }

    const user = await this.prisma.userAccount.findFirst({
      where: {
        OR: [{ username: identifier }, { nik: identifier }],
      },
    })
    if (user) {
      if (user.isActive === false) throw new UnauthorizedException('Kredensial tidak valid')
      await this.compareOrThrow(password, user.password)
      return { ...user, accountType: 'user_account' as const, email: user.email }
    }

    throw new UnauthorizedException('Kredensial tidak valid')
  }

  async login(admin: AuthenticatedUser) {
    const identifier = admin.employeeNo ?? admin.nik ?? admin.username
    const email = admin.email ?? ''
    const payload = { sub: admin.id, jti: randomUUID(), tokenVersion: admin.tokenVersion ?? 0, employeeNo: identifier, fullName: admin.fullName ?? admin.name, role: admin.role, accountType: admin.accountType, email }
    return {
      access_token: this.jwt.sign(payload),
      admin: { id: admin.id, employeeNo: identifier, fullName: admin.fullName ?? admin.name, role: admin.role, accountType: admin.accountType, email, photoUrl: admin.photoUrl ?? null },
    }
  }

  async validateSession(payload: { sub: number; accountType?: string; tokenVersion?: number }) {
    const kind = payload.accountType === 'user_account' ? 'user_account' : 'master_admin'
    const account = kind === 'user_account'
      ? await this.prisma.userAccount.findUnique({ where: { id: payload.sub } })
      : await this.prisma.masterAdmin.findUnique({ where: { id: payload.sub } })

    if (!account || account.isActive === false || (payload.tokenVersion ?? 0) !== account.tokenVersion) {
      throw new UnauthorizedException('Sesi tidak valid')
    }

    const typed = account as any
    return {
      sub: typed.id,
      employeeNo: typed.employeeNo ?? typed.nik ?? typed.username,
      fullName: typed.fullName ?? typed.name,
      role: typed.role,
      kind,
      email: typed.email ?? '',
      photoUrl: typed.photoUrl ?? null,
    }
  }

  async revokeSession(sub: number, kind: string) {
    if (kind === 'user_account') {
      await this.prisma.userAccount.update({ where: { id: sub }, data: { tokenVersion: { increment: 1 } } })
    } else {
      await this.prisma.masterAdmin.update({ where: { id: sub }, data: { tokenVersion: { increment: 1 } } })
    }
  }

  async changePassword(adminId: number, oldPassword: string, newPassword: string) {
    const admin = await this.prisma.masterAdmin.findUnique({ where: { id: adminId } })
    if (!admin) throw new UnauthorizedException('Admin tidak ditemukan')
    const valid = await bcrypt.compare(oldPassword, admin.password)
    if (!valid) throw new UnauthorizedException('Password lama salah')
    const hashed = await bcrypt.hash(newPassword, 10)
    await this.prisma.masterAdmin.update({ where: { id: adminId }, data: { password: hashed, tokenVersion: { increment: 1 } } })
    return { message: 'Password berhasil diubah' }
  }

  async changeUserPassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException('User tidak ditemukan')
    await this.compareOrThrow(oldPassword, user.password)
    const hashed = await bcrypt.hash(newPassword, 10)
    await this.prisma.userAccount.update({ where: { id: userId }, data: { password: hashed, tokenVersion: { increment: 1 } } })
    return { message: 'Password berhasil diubah' }
  }

  async updateProfilePhoto(sub: number, kind: string, photoUrl: string) {
    const previousUrl = await this.getProfilePhoto(sub, kind)
    if (previousUrl && previousUrl !== photoUrl) {
      const filePath = join(process.cwd(), previousUrl.replace(/^\//, ''))
      if (existsSync(filePath)) {
        try { unlinkSync(filePath) } catch { /* non-fatal */ }
      }
    }

    if (kind === 'user_account') {
      return this.prisma.userAccount.update({
        where: { id: sub },
        data: { photoUrl },
        select: { id: true, photoUrl: true },
      })
    }
    return this.prisma.masterAdmin.update({
      where: { id: sub },
      data: { photoUrl },
      select: { id: true, photoUrl: true },
    })
  }

  async clearProfilePhoto(sub: number, kind: string) {
    if (kind === 'user_account') {
      return this.prisma.userAccount.update({
        where: { id: sub },
        data: { photoUrl: null },
        select: { id: true, photoUrl: true },
      })
    }
    return this.prisma.masterAdmin.update({
      where: { id: sub },
      data: { photoUrl: null },
      select: { id: true, photoUrl: true },
    })
  }

  async getProfilePhoto(sub: number, kind: string): Promise<string | null> {
    const row = kind === 'user_account'
      ? await this.prisma.userAccount.findUnique({ where: { id: sub }, select: { photoUrl: true } })
      : await this.prisma.masterAdmin.findUnique({ where: { id: sub }, select: { photoUrl: true } })
    return row?.photoUrl ?? null
  }
}
