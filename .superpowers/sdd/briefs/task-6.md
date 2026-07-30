# Task 6: Update Cron untuk Baca Config

## Objective
Update `ContractCronService` to read trigger windows and recipients from the database (via `EmailNotificationConfigService`) instead of hardcoded values, and add deduplication via `EmailNotificationSentLog`.

## Files to Modify
- `backend/src/contract-cron/contract-cron.service.ts` — main changes
- `backend/src/contract-cron/contract-cron.module.ts` — import EmailNotificationConfigModule
- `backend/src/maileroo/maileroo.service.ts` — add `recipients` param to all 4 send methods

## Context: Current Behavior
The cron currently:
1. Runs daily at 00:01 WIB
2. Evaluates AKAN_HABIS at <= 30 days (hardcoded)
3. Calls `maileroo.sendContractStatusNotification(changes)` and `sendDocumentStatusNotification(changes)` — these internally fetch ALL UserAccount emails
4. Also calls `sendVendorContractNotification` and `sendLegalKoperasiNotification` via vendor/legalKoperasi services

## Changes Required

### 1. `maileroo.service.ts` — Add `recipients` parameter

All 4 public send methods currently do `prisma.userAccount.findMany(...)` to build the recipient list. Change them to accept an explicit `recipients` param:

```typescript
// Before:
async sendContractStatusNotification(changes: ContractStatusChange[]): Promise<boolean>

// After:
async sendContractStatusNotification(
  changes: ContractStatusChange[],
  recipients: { email: string; name: string }[]
): Promise<boolean>
```

Do the same for:
- `sendDocumentStatusNotification(changes, recipients)`
- `sendVendorContractNotification(changes, recipients)`
- `sendLegalKoperasiNotification(changes, recipients)`

Inside each method: REMOVE the `prisma.userAccount.findMany` block. Use the `recipients` param directly. Add early return `if (!recipients.length) return false` at the top (after changes.length check).

Note: `MailerooService` constructor already has `private prisma: PrismaService` — this is still needed for other things potentially, or can be removed if only used for user fetch. Check if prisma is used elsewhere in the service before removing it.

### 2. `contract-cron.module.ts` — Import EmailNotificationConfigModule

```typescript
import { EmailNotificationConfigModule } from '../email-notification-config/email-notification-config.module'

@Module({
  imports: [PrismaModule, MailerooModule, VendorContractsModule, LegalKoperasiModule, NotificationsModule, EmailNotificationConfigModule],
  providers: [ContractCronService],
})
```

### 3. `contract-cron.service.ts` — Inject and use EmailNotificationConfigService

#### 3a. Constructor injection:
```typescript
constructor(
  private prisma: PrismaService,
  private maileroo: MailerooService,
  private vendorContractsService: VendorContractsService,
  private legalKoperasiService: LegalKoperasiService,
  private notificationsService: NotificationsService,
  private emailConfig: EmailNotificationConfigService,  // ← add this
) {}
```

Add import at top: `import { EmailNotificationConfigService } from '../email-notification-config/email-notification-config.service'`

#### 3b. At the start of `syncContractStatuses()`, after the logger.log line:

```typescript
// Read email config from DB
const emailEnabled = await this.emailConfig.isEnabled()
const recipients = emailEnabled ? await this.emailConfig.getActiveRecipients() : []
const triggerWindows = await this.emailConfig.getTriggerWindows()
```

#### 3c. Contract email sending — deduplicate per window

Find the section where `this.maileroo.sendContractStatusNotification(updates)` is called. Currently it sends all AKAN_HABIS/EXPIRED changes at once.

Replace the contract email sending block with per-window logic:

```typescript
if (emailEnabled && recipients.length > 0 && updates.length > 0) {
  const today = startOfDay(new Date())
  
  for (const window of triggerWindows) {
    // Find contracts whose daysLeft === window
    const changesForWindow = []
    for (const u of updates) {
      if (u.newStatus === 'AKAN_HABIS') {
        const daysLeft = Math.ceil((startOfDay(u.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (daysLeft === window) {
          const alreadySent = await this.emailConfig.hasSent('contract', u.id, window)
          if (!alreadySent) {
            changesForWindow.push(u)
          }
        }
      }
    }
    
    if (changesForWindow.length > 0) {
      const sent = await this.maileroo.sendContractStatusNotification(changesForWindow, recipients)
      if (sent) {
        for (const u of changesForWindow) {
          await this.emailConfig.recordSent('contract', u.id, window)
        }
      }
    }
  }
  
  // Also send EXPIRED contracts (window = 0 means expired, but we also handle explicit expired)
  const expiredChanges = updates.filter(u => u.newStatus === 'EXPIRED')
  const expiredUnsent = []
  for (const u of expiredChanges) {
    const alreadySent = await this.emailConfig.hasSent('contract', u.id, -1) // -1 = expired sentinel
    if (!alreadySent) expiredUnsent.push(u)
  }
  if (expiredUnsent.length > 0) {
    const sent = await this.maileroo.sendContractStatusNotification(expiredUnsent, recipients)
    if (sent) {
      for (const u of expiredUnsent) {
        await this.emailConfig.recordSent('contract', u.id, -1)
      }
    }
  }
}
```

#### 3d. Document email sending — same pattern

Find where `sendDocumentStatusNotification` is called. Apply same approach:
```typescript
await this.maileroo.sendDocumentStatusNotification(docChanges, recipients)
```
(For simplicity, document changes don't need per-window deduplication at this stage — just pass recipients. The per-window logic for docs can be a future enhancement. Just add the `recipients` param.)

#### 3e. Vendor and LegalKoperasi notifications

These are called via `vendorContractsService` and `legalKoperasiService`, which internally call maileroo. You need to check how they call maileroo and update those call sites too.

Find:
- `backend/src/vendor-contracts/vendor-contracts.service.ts` — look for calls to `maileroo.sendVendorContractNotification`
- `backend/src/legal-koperasi/legal-koperasi.service.ts` — look for calls to `maileroo.sendLegalKoperasiNotification`

These services likely don't have `EmailNotificationConfigService` injected. For now, pass `recipients` down to them from the cron, OR if that's complex, pass an empty array as a placeholder — but note it as a concern.

**Pragmatic approach:** If changing vendor/legal services is complex (requires injecting emailConfig into those modules too), just update the `MailerooService` method signatures to make `recipients` optional with a fallback:

```typescript
async sendVendorContractNotification(
  changes: ...,
  recipients?: { email: string; name: string }[]
): Promise<boolean> {
  const actualRecipients = recipients ?? await this.prisma.userAccount.findMany({...}).then(...)
  // use actualRecipients
}
```

This is backward-compatible and unblocks the task without a large cascade of changes.

## Verify
```bash
cd backend && npx tsc --noEmit
```
Must be 0 errors.

## Commit Message
`feat(backend): cron baca trigger windows + recipients dari DB, deduplikasi via sentLog`
