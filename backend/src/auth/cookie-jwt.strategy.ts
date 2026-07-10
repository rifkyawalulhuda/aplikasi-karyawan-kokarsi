import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Request } from 'express'

interface JwtPayload {
  sub: number
  employeeNo: string
  fullName: string
  role: string
  accountType: string
  email: string
}

@Injectable()
export class CookieJwtStrategy extends PassportStrategy(Strategy, 'jwt-cookie') {
  constructor() {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }
    super({
      jwtFromRequest: (req: Request) => {
        return req?.cookies?.auth_token ?? null
      },
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: JwtPayload) {
    return { sub: payload.sub, employeeNo: payload.employeeNo, fullName: payload.fullName, role: payload.role ?? 'ADMIN', kind: payload.accountType ?? 'master_admin' }
  }
}
