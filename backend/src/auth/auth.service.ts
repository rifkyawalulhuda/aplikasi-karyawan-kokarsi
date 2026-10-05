import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { JwtSignOptions } from '@nestjs/jwt'
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

// Masa berlaku access token harus sinkron dengan maxAge cookie `auth_token`
// di server/utils/auth-cookies.ts (Nuxt). Default 15 menit.
const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as JwtSignOptions['expiresIn']
// Masa berlaku refresh token harus sinkron dengan maxAge cookie `refresh_token`
// di server/utils/auth-cookies.ts (Nuxt). Default 7 hari.
const REFRESH_TOKEN_TTL = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as JwtSignOptions['expiresIn']

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

  /** Secret khusus refresh token — beda dari access token agar refresh token
   *  tidak bisa diputar ulang sebagai access token (defense in depth). */
  private get refreshSecret() {
    return process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET!
  }

  private accessTokenPayload(user: AuthenticatedUser) {
    const identifier = user.employeeNo ?? user.nik ?? user.username
    const email = user.email ?? ''
    return {
      sub: user.id,
      jti: randomUUID(),
      type: 'access' as const,
      tokenVersion: user.tokenVersion ?? 0,
      employeeNo: identifier,
      fullName: user.fullName ?? user.name,
      role: user.role,
      accountType: user.accountType,
      email,
    }
  }

  private refreshTokenPayload(user: Pick<AuthenticatedUser, 'id' | 'accountType' | 'tokenVersion'>) {
    return {
      sub: user.id,
      jti: randomUUID(),
      type: 'refresh' as const,
      tokenVersion: user.tokenVersion ?? 0,
      accountType: user.accountType,
    }
  }

  private refreshAdminSummary(user: AuthenticatedUser) {
    const identifier = user.employeeNo ?? user.nik ?? user.username
    return {
      id: user.id,
      employeeNo: identifier,
      fullName: user.fullName ?? user.name,
      role: user.role,
      accountType: user.accountType,
      email: user.email ?? '',
      photoUrl: user.photoUrl ?? null,
    }
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
    return {
      access_token: this.jwt.sign(this.accessTokenPayload(admin), { expiresIn: ACCESS_TOKEN_TTL }),
      refresh_token: this.jwt.sign(this.refreshTokenPayload(admin), { secret: this.refreshSecret, expiresIn: REFRESH_TOKEN_TTL }),
      admin: this.refreshAdminSummary(admin),
    }
  }

  /**
   * Tukar refresh token yang valid dengan pasangan token baru (rotasi).
   * Validasi: tipe token, tanda tangan, akun masih aktif, dan tokenVersion
   * masih cocok (logout / ganti password otomatis mencabut refresh token lama).
   */
  async refreshSession(refreshToken: string) {
    let payload: { sub: number; type?: string; tokenVersion?: number; accountType?: string }
    try {
      payload = this.jwt.verify(refreshToken, { secret: this.refreshSecret })
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid')
    }

    if (payload?.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token tidak valid')
    }

    const kind = payload.accountType === 'user_account' ? 'user_account' : 'master_admin'
    const account = kind === 'user_account'
      ? await this.prisma.userAccount.findUnique({ where: { id: payload.sub } })
      : await this.prisma.masterAdmin.findUnique({ where: { id: payload.sub } })

    if (!account || account.isActive === false || (payload.tokenVersion ?? 0) !== account.tokenVersion) {
      throw new UnauthorizedException('Sesi sudah dicabut, silakan login kembali')
    }

    return this.login({ ...account, accountType: kind } as AuthenticatedUser)
  }

  /**
   * Cabut seluruh sesi akun pemilik refresh token (increment tokenVersion).
   * Token dengan tanda tangan tidak valid diabaikan tanpa error agar
   * logout selalu berhasil dari sisi client.
   */
  async revokeByRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, { secret: this.refreshSecret })
      if (payload?.type === 'refresh' && payload?.sub) {
        const kind = payload.accountType === 'user_account' ? 'user_account' : 'master_admin'
        await this.revokeSession(payload.sub, kind)
      }
    } catch {
      // Refresh token tidak valid/kadaluarsa — tidak ada yang perlu dicabut.
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
