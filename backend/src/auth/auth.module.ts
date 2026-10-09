import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import type { JwtSignOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './jwt.strategy'
import { LocalStrategy } from './local.strategy'
import { CookieJwtStrategy } from './cookie-jwt.strategy'

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required')
        }
        return {
          secret,
          signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as JwtSignOptions['expiresIn'] },
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, CookieJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
