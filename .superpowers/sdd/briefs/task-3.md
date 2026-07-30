# Task 3: Backend Controller + Nuxt Proxy

## Objective
Create the NestJS controller for `EmailNotificationConfig`, register the module in `app.module.ts`, and create Nuxt server proxy files.

## Files to Create
- `backend/src/email-notification-config/email-notification-config.controller.ts`
- `server/api/settings/email-config.get.ts`
- `server/api/settings/email-config.put.ts`
- `server/api/settings/email-config-users.get.ts`

## Files to Modify
- `backend/src/app.module.ts` — import `EmailNotificationConfigModule`

## Controller

The controller lives at `backend/src/email-notification-config/email-notification-config.controller.ts`.

Look at `backend/src/settings/settings.controller.ts` for the exact pattern — especially how it:
1. Uses `@UseGuards(JwtAuthGuard)`
2. Extracts role and username from JWT via `@Req() req` (the user object is at `req.user`)
3. Returns service results directly

```typescript
import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { EmailNotificationConfigService } from './email-notification-config.service'
import { UpdateEmailConfigDto } from './dto/update-email-config.dto'

@Controller('email-notification-config')
export class EmailNotificationConfigController {
  constructor(private readonly service: EmailNotificationConfigService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getConfig() {
    return this.service.getConfig()
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  async updateConfig(@Body() dto: UpdateEmailConfigDto, @Req() req: any) {
    const role = req.user?.role
    const username = req.user?.username ?? req.user?.name ?? 'unknown'
    return this.service.updateConfig(dto, role, username)
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getUsers() {
    return this.service.getAllUsers()
  }
}
```

Note: Check `settings.controller.ts` to confirm how `req.user` is shaped — use the same field names.

## Module Update

Add controller to `email-notification-config.module.ts`:
```typescript
@Module({
  imports: [PrismaModule],
  controllers: [EmailNotificationConfigController],
  providers: [EmailNotificationConfigService],
  exports: [EmailNotificationConfigService],
})
```

## Register in app.module.ts

Find `backend/src/app.module.ts`. Add `EmailNotificationConfigModule` to the `imports` array.
Follow the existing import pattern exactly.

## Nuxt Proxy Files

Look at `server/api/settings/general.get.ts` and `server/api/settings/general.put.ts` for the exact proxy pattern (how they read `BACKEND` URL and forward auth token).

**`server/api/settings/email-config.get.ts`:**
```typescript
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getCookie(event, 'auth_token')
  const res = await fetch(`${config.backendUrl}/email-notification-config`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw createError({ statusCode: res.status })
  return res.json()
})
```

**`server/api/settings/email-config.put.ts`:**
```typescript
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getCookie(event, 'auth_token')
  const body = await readBody(event)
  const res = await fetch(`${config.backendUrl}/email-notification-config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw createError({ statusCode: res.status, message: (err as any)?.message })
  }
  return res.json()
})
```

**`server/api/settings/email-config-users.get.ts`:**
```typescript
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getCookie(event, 'auth_token')
  const res = await fetch(`${config.backendUrl}/email-notification-config/users`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw createError({ statusCode: res.status })
  return res.json()
})
```

NOTE: Check the existing proxy files first to confirm the exact pattern — the `backendUrl` key name and how `getCookie` is called. Match it exactly.

## Verify

```bash
cd backend && npx tsc --noEmit
```
Should produce 0 errors.

## Commit Message
`feat(backend): email notification config controller + nuxt proxy`
