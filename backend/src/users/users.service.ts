import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt')

type UserRole = 'ADMIN' | 'PENGELOLA_KOPERASI'

interface CreateUserInput {
  name: string
  nik: string
  email: string
  role: UserRole
  username: string
  password: string
}

interface UpdateUserInput extends Partial<CreateUserInput> {}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    name: true,
    nik: true,
    email: true,
    role: true,
    username: true,
    createdAt: true,
    updatedAt: true,
  } as const

  private async hashPassword(password: string) {
    return bcrypt.hash(password, 10)
  }

  private isAdmin(role?: string) {
    return role === 'ADMIN'
  }

  private ensureAdmin(role?: string) {
    if (!this.isAdmin(role)) {
      throw new ForbiddenException('Role Pengelola Koperasi tidak dapat mengubah data User')
    }
  }

  private handleUniqueError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error
    }

    const targets = Array.isArray(error.meta?.target) ? error.meta?.target : [error.meta?.target].filter(Boolean)
    const fieldLabels: Record<string, string> = {
      nik: 'NIK',
      email: 'Email',
      username: 'Username',
    }

    const fieldErrors = targets.reduce((acc, field) => {
      const key = String(field)
      acc[key] = `${fieldLabels[key] ?? key} sudah digunakan`
      return acc
    }, {} as Record<string, string>)

    const duplicateFields = targets.map((field) => fieldLabels[String(field)] ?? String(field))
    const message = duplicateFields.length > 0
      ? `${duplicateFields.join(', ')} sudah terdaftar. Gunakan nilai lain.`
      : 'Data user sudah terdaftar. Gunakan nilai lain.'

    throw new ConflictException({
      message,
      fieldErrors,
    })
  }

  getAll() {
    return this.prisma.userAccount.findMany({
      orderBy: { name: 'asc' },
      select: this.userSelect,
    })
  }

  async create(data: CreateUserInput) {
    const password = await this.hashPassword(data.password)
    try {
      return await this.prisma.userAccount.create({
        data: {
          name: data.name,
          nik: data.nik,
          email: data.email,
          role: data.role,
          username: data.username,
          password,
        },
        select: this.userSelect,
      })
    } catch (error) {
      this.handleUniqueError(error)
    }
  }

  async update(id: number, data: UpdateUserInput) {
    const updateData: Record<string, any> = {
      name: data.name,
      nik: data.nik,
      email: data.email,
      role: data.role,
      username: data.username,
    }

    if (data.password?.trim()) {
      updateData.password = await this.hashPassword(data.password)
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key]
    })

    try {
      return await this.prisma.userAccount.update({
        where: { id },
        data: updateData,
        select: this.userSelect,
      })
    } catch (error) {
      this.handleUniqueError(error)
    }
  }

  delete(id: number) {
    return this.prisma.userAccount.delete({
      where: { id },
      select: this.userSelect,
    })
  }

  guardAdmin(role?: string) {
    this.ensureAdmin(role)
  }
}
