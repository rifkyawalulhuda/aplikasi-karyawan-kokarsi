# Task 2: Backend EmailNotificationConfigService

## Objective
Create the `EmailNotificationConfigService` NestJS service with all methods needed by the controller and the cron job.

## Files to Create
- `backend/src/email-notification-config/email-notification-config.service.ts`
- `backend/src/email-notification-config/dto/update-email-config.dto.ts`
- `backend/src/email-notification-config/email-notification-config.module.ts`

## Architecture Context
- Stack: NestJS + Prisma + PostgreSQL
- Config values (`isEnabled`, `triggerWindows`) are stored in the existing `AppSetting` table (key/value), NOT new tables
  - key `emailNotificationEnabled` → `"true"` | `"false"`
  - key `emailNotificationWindows` → CSV string like `"90,60,30,7,0"`
- `EmailNotificationRecipient` model stores which user accounts receive emails (added in Task 1)
- `EmailNotificationSentLog` model deduplicates sends (added in Task 1)
- `EmailNotificationConfigLog` model stores audit trail (added in Task 1)
- Follow the pattern from `backend/src/settings/settings.service.ts` for AppSetting reads/upserts

## Service Interface

```typescript
// Return type for getConfig
interface EmailNotificationConfigDto {
  isEnabled: boolean
  triggerWindows: number[]
  recipients: { id: number; name: string; email: string }[]
}
```

## Required Methods

### `getConfig(): Promise<EmailNotificationConfigDto>`
- Read `AppSetting` key `emailNotificationEnabled` (default `true` if not set)
- Read `AppSetting` key `emailNotificationWindows` (default `[90, 60, 30, 7, 0]` if not set)
- Read all `EmailNotificationRecipient` rows joined with `UserAccount` (select id, name, email)
- Return combined object

### `updateConfig(dto: UpdateEmailConfigDto, username: string): Promise<EmailNotificationConfigDto>`
- Call `ensureAdmin(role)` — ADMIN role only. Read how `settings.service.ts` does this.
- Deduplicate `dto.triggerWindows` (remove duplicates, filter <= 0)
- Upsert `AppSetting` key `emailNotificationEnabled` with `dto.isEnabled.toString()`
- Upsert `AppSetting` key `emailNotificationWindows` with `dto.triggerWindows.join(',')`
- Delete all existing `EmailNotificationRecipient` rows
- Insert new ones from `dto.recipientUserIds`
- Insert one `EmailNotificationConfigLog` row with `changedBy = username`, `description` summarizing the change (e.g. "Update config: enabled=true, windows=[90,60,30,7], recipients=[2,5]")
- Return `getConfig()`

Note: `updateConfig` also receives `role` param — add it to signature: `updateConfig(dto: UpdateEmailConfigDto, role: string, username: string)`

### `getAllUsers(): Promise<{ id: number; name: string; email: string }[]>`
- `prisma.userAccount.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } })`

### `isEnabled(): Promise<boolean>`
- Read `AppSetting` key `emailNotificationEnabled`, return `true` if not set or value is `"true"`

### `getTriggerWindows(): Promise<number[]>`
- Read `AppSetting` key `emailNotificationWindows`
- Parse CSV, filter valid positive integers
- Return `[90, 60, 30, 7, 0]` if not set

### `getActiveRecipients(): Promise<{ email: string; name: string }[]>`
- Read all `EmailNotificationRecipient` rows joined with `UserAccount`, filter out empty emails

### `hasSent(sourceType: string, sourceId: number, triggerDay: number): Promise<boolean>`
- Check if `EmailNotificationSentLog` has a row for the given combination

### `recordSent(sourceType: string, sourceId: number, triggerDay: number): Promise<void>`
- Upsert `EmailNotificationSentLog` for the given combination (use upsert with unique constraint)

## DTO

```typescript
// dto/update-email-config.dto.ts
export class UpdateEmailConfigDto {
  isEnabled: boolean
  triggerWindows: number[]   // will be deduped + filtered in service
  recipientUserIds: number[] // can be empty
}
```

## Module

```typescript
// email-notification-config.module.ts
import { Module } from '@nestjs/common'
import { EmailNotificationConfigService } from './email-notification-config.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [EmailNotificationConfigService],
  exports: [EmailNotificationConfigService],
})
export class EmailNotificationConfigModule {}
```

## Reference Files to Read
- `backend/src/settings/settings.service.ts` — follow the same patterns for AppSetting upsert and `ensureAdmin`
- `backend/prisma/schema.prisma` — to understand the new models from Task 1

## Verify
```bash
cd backend && npx tsc --noEmit
```
Should produce 0 type errors.

## Commit Message
`feat(backend): EmailNotificationConfigService`
