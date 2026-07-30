# Task 6 Report: Update Cron untuk Baca Config

## Status: DONE

## Commits Created

- `c2e630e` feat(backend): cron baca trigger windows + recipients dari DB, deduplikasi via sentLog

## Verification

`npx tsc --noEmit` from `backend/` — **0 errors**

## Changes Made

### 1. `backend/src/maileroo/maileroo.service.ts`
All 4 public send methods updated with optional `recipients` param and fallback to `prisma.userAccount.findMany`:
- `sendContractStatusNotification(changes, recipients?)`
- `sendDocumentStatusNotification(changes, recipients?)`
- `sendVendorContractNotification(changes, recipients?)`
- `sendLegalKoperasiNotification(changes, recipients?)`

Backward-compatible: callers that don't pass `recipients` (vendor/legal services) fall back to fetching all UserAccount emails from DB.

### 2. `backend/src/contract-cron/contract-cron.module.ts`
Added `EmailNotificationConfigModule` to imports.

### 3. `backend/src/contract-cron/contract-cron.service.ts`
- Added `EmailNotificationConfigService` import and constructor injection
- At start of `syncContractStatuses()`: reads `emailEnabled`, `recipients`, `triggerWindows` from DB
- Replaced old flat `sendContractStatusNotification(notifyChanges)` with per-window dedup loop:
  - AKAN_HABIS: iterates each trigger window, checks `hasSent('contract', id, window)`, skips already-sent
  - EXPIRED: uses sentinel `-1`, skips already-sent via `hasSent('contract', id, -1)`
  - On success: calls `recordSent` for each sent contract
- `sendDocumentStatusNotification` calls (both AKAN_EXPIRED and EXPIRED) now pass `recipients`
- `sendVendorContractNotification` and `sendLegalKoperasiNotification` calls now pass `recipients` (they fall back to all-UserAccount via the optional param fallback in maileroo)

## Concerns

- **Vendor/Legal notifications still use UserAccount fallback**: `sendVendorContractNotification` and `sendLegalKoperasiNotification` are called with the cron's `recipients` list, which comes from `EmailNotificationRecipient` table. This is the correct behavior — same config-driven recipients for all notification types.
- **Document notifications have no per-window dedup**: As specified in the brief, document status notifications (AKAN_EXPIRED / EXPIRED) do not yet use `hasSent`/`recordSent` deduplication. This is a future enhancement.
- **AKAN_HABIS window matching**: Contracts are only included in AKAN_HABIS notifications if their `daysLeft` exactly matches one of the configured trigger windows. Contracts with daysLeft values not in the windows array will silently receive no email — this is the intended behavior per the spec.

## Report File

`E:\Github\aplikasi-karyawan-kokarsi\.superpowers\sdd\reports\task-6-report.md`
