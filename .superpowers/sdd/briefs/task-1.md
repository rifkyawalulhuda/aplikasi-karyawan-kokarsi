# Task 1: Prisma Schema + Migration

## Objective
Add 3 new models to `backend/prisma/schema.prisma` and generate the Prisma migration.

## Files to Modify
- `backend/prisma/schema.prisma` — add 3 new models + relation on UserAccount

## Files Created by Prisma
- `backend/prisma/migrations/<timestamp>_add_email_notification_config/migration.sql` (auto-generated)

## Exact Changes to schema.prisma

### 1. Add relation field to UserAccount model
Inside the existing `UserAccount` model, add:
```prisma
emailNotificationRecipient EmailNotificationRecipient?
```

### 2. Add 3 new models (append to end of file)

```prisma
model EmailNotificationRecipient {
  id            Int         @id @default(autoincrement())
  userAccountId Int
  userAccount   UserAccount @relation(fields: [userAccountId], references: [id], onDelete: Cascade)
  createdAt     DateTime    @default(now())

  @@unique([userAccountId])
  @@map("email_notification_recipients")
}

model EmailNotificationSentLog {
  id         Int      @id @default(autoincrement())
  sourceType String   @db.VarChar(50)
  sourceId   Int
  triggerDay Int
  sentAt     DateTime @default(now())

  @@unique([sourceType, sourceId, triggerDay])
  @@map("email_notification_sent_log")
}

model EmailNotificationConfigLog {
  id          Int      @id @default(autoincrement())
  changedBy   String   @db.VarChar(255)
  description String   @db.Text
  createdAt   DateTime @default(now())

  @@map("email_notification_config_log")
}
```

## Notes
- Config values `emailNotificationEnabled` and `emailNotificationWindows` are stored in the existing `AppSetting` table (key/value), NOT in new tables. No new model needed for those.
- `EmailNotificationSentLog` deduplicates email sends: one row per (sourceType, sourceId, triggerDay)
- `EmailNotificationConfigLog` is an audit trail of admin config changes

## Steps
1. Edit `backend/prisma/schema.prisma` as described above
2. From the `backend/` directory, run:
   ```
   npx prisma migrate dev --name add_email_notification_config
   ```
3. Verify migration ran successfully

## Verify
```bash
cd backend && npx prisma migrate status
```
Should show the new migration as "Applied".

## Commit Message
`feat(db): add email notification config tables`
