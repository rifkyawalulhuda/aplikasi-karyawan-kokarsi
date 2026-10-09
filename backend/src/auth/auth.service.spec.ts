// Mock prisma module SEBELUM import apapun agar tidak trigger DATABASE_URL check
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}))

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

import { AuthService } from './auth.service'
import { UnauthorizedException } from '@nestjs/common'

// JWT secret fallback untuk unit test (refreshSecret getter membaca env ini)
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-32-karakter-untuk-jest'

const bcrypt = require('bcrypt')

// Mock PrismaService instance
const mockPrisma = {
  masterAdmin: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userAccount: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

// Mock JwtService
const mockJwt = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
}

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AuthService(mockPrisma as any, mockJwt as any)
  })

  describe('validateAdmin', () => {
    it('harus throw UnauthorizedException jika kredensial tidak ditemukan', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue(null)
      mockPrisma.userAccount.findFirst.mockResolvedValue(null)

      await expect(service.validateAdmin('unknown', 'wrongpass'))
        .rejects.toThrow(UnauthorizedException)
    })

    it('harus throw UnauthorizedException jika password master admin salah', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue({
        id: 1,
        employeeNo: 'EMP001',
        password: 'hashedpass',
        role: 'ADMIN',
        fullName: 'Admin',
      })
      bcrypt.compare.mockResolvedValue(false)

      await expect(service.validateAdmin('EMP001', 'wrongpass'))
        .rejects.toThrow(UnauthorizedException)
    })

    it('harus return user jika kredensial master admin valid', async () => {
      const mockAdmin = {
        id: 1,
        employeeNo: 'EMP001',
        password: 'hashedpass',
        role: 'ADMIN',
        fullName: 'Admin Test',
      }
      mockPrisma.masterAdmin.findUnique.mockResolvedValue(mockAdmin)
      bcrypt.compare.mockResolvedValue(true)

      const result = await service.validateAdmin('EMP001', 'correctpass')
      expect(result).toMatchObject({ employeeNo: 'EMP001', accountType: 'master_admin' })
    })

    it('harus return user jika kredensial user account valid', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue(null)
      const mockUser = {
        id: 2,
        username: 'pengelola1',
        nik: '123456',
        password: 'hashedpass',
        role: 'PENGELOLA_KOPERASI',
        fullName: 'Pengelola',
        email: 'pengelola@test.com',
      }
      mockPrisma.userAccount.findFirst.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)

      const result = await service.validateAdmin('pengelola1', 'correctpass')
      expect(result).toMatchObject({ username: 'pengelola1', accountType: 'user_account' })
    })
  })

  describe('login', () => {
    it('harus return access_token dan admin info', async () => {
      const mockAdmin = {
        id: 1,
        employeeNo: 'EMP001',
        fullName: 'Admin Test',
        role: 'ADMIN' as const,
        accountType: 'master_admin' as const,
        email: 'admin@test.com',
      }

      const result = await service.login(mockAdmin)

      expect(result).toHaveProperty('access_token', 'mock.jwt.token')
      expect(result).toHaveProperty('refresh_token', 'mock.jwt.token')
      expect(result).toHaveProperty('admin')
      expect(result.admin).toMatchObject({ id: 1, employeeNo: 'EMP001', role: 'ADMIN' })
      // Access token: payload berisi identitas + tipe 'access'
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 1, role: 'ADMIN', type: 'access' }),
        expect.objectContaining({ expiresIn: expect.anything() })
      )
      // Refresh token: payload tipe 'refresh' + secret terpisah
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 1, type: 'refresh' }),
        expect.objectContaining({ secret: expect.any(String), expiresIn: expect.anything() })
      )
    })

    it('harus gunakan nik jika employeeNo tidak ada', async () => {
      const mockUser = {
        id: 2,
        nik: '123456',
        fullName: 'Pengelola',
        role: 'PENGELOLA_KOPERASI' as const,
        accountType: 'user_account' as const,
        email: 'pengelola@test.com',
      }

      const result = await service.login(mockUser)
      expect(result.admin.employeeNo).toBe('123456')
    })
  })

  describe('changePassword', () => {
    it('harus throw jika admin tidak ditemukan', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue(null)

      await expect(service.changePassword(999, 'old', 'new'))
        .rejects.toThrow(UnauthorizedException)
    })

    it('harus throw jika password lama salah', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue({
        id: 1, password: 'hashedpass',
      })
      bcrypt.compare.mockResolvedValue(false)

      await expect(service.changePassword(1, 'wrongold', 'newpass'))
        .rejects.toThrow(UnauthorizedException)
    })

    it('harus berhasil update password jika semua valid', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue({
        id: 1, password: 'hashedpass',
      })
      bcrypt.compare.mockResolvedValue(true)
      bcrypt.hash.mockResolvedValue('newhashedpass')
      mockPrisma.masterAdmin.update.mockResolvedValue({})

      const result = await service.changePassword(1, 'correctold', 'newpass')
      expect(result).toEqual({ message: 'Password berhasil diubah' })
      expect(mockPrisma.masterAdmin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'newhashedpass',
            tokenVersion: { increment: 1 },
          }),
        })
      )
    })
  })

  describe('validateSession', () => {
    it('harus menolak akun nonaktif', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue({
        id: 1,
        isActive: false,
        tokenVersion: 0,
      })

      await expect(service.validateSession({ sub: 1, accountType: 'master_admin', tokenVersion: 0 }))
        .rejects.toThrow(UnauthorizedException)
    })

    it('harus menolak token dengan tokenVersion lama', async () => {
      mockPrisma.userAccount.findUnique.mockResolvedValue({
        id: 2,
        isActive: true,
        tokenVersion: 2,
      })

      await expect(service.validateSession({ sub: 2, accountType: 'user_account', tokenVersion: 1 }))
        .rejects.toThrow(UnauthorizedException)
    })

    it('harus membangun identity dari data database', async () => {
      mockPrisma.masterAdmin.findUnique.mockResolvedValue({
        id: 1,
        employeeNo: 'EMP001',
        fullName: 'Admin Database',
        role: 'ADMIN',
        isActive: true,
        tokenVersion: 3,
      })

      await expect(service.validateSession({
        sub: 1,
        accountType: 'master_admin',
        tokenVersion: 3,
      })).resolves.toMatchObject({
        sub: 1,
        fullName: 'Admin Database',
        role: 'ADMIN',
        kind: 'master_admin',
      })
    })
  })
})
