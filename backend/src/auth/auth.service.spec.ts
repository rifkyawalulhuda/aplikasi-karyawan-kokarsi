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
      expect(result).toHaveProperty('admin')
      expect(result.admin).toMatchObject({ id: 1, employeeNo: 'EMP001', role: 'ADMIN' })
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 1, role: 'ADMIN' })
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
        expect.objectContaining({ data: { password: 'newhashedpass' } })
      )
    })
  })
})
