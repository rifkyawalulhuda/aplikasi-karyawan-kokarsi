import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Request } from 'express'
import { AuthService } from './auth.service'

interface JwtPayload {
  sub: number
  employeeNo: string
  fullName: string
  role: string
  accountType: string
  tokenVersion?: number
  email: string
}

@Injectable()
export class CookieJwtStrategy extends PassportStrategy(Strategy, 'jwt-cookie') {
  constructor(private readonly auth: AuthService) {
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
    return this.auth.validateSession(payload)
  }
}
