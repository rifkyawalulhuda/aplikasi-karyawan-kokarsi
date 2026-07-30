# Task 8: Frontend Types

## Objective
Add TypeScript types for the Email Notification Config feature to the frontend types file.

## Files to Modify
Find the existing types file. It's likely at `app/types/index.ts` or similar. Check by looking at imports in `app/pages/settings/index.vue` — it imports `type { GeneralSettings } from '~/types'`. Find that file.

## Types to Add

```typescript
export interface EmailNotificationConfig {
  isEnabled: boolean
  triggerWindows: number[]
  recipients: EmailNotificationUser[]
}

export interface EmailNotificationUser {
  id: number
  name: string
  email: string
}
```

## Steps
1. Find the types file by checking what `~/types` resolves to (likely `app/types/index.ts` or `app/types.ts`)
2. Add the two interfaces above following the same style as existing interfaces in the file
3. No verification command needed — TypeScript will pick this up in the next compile

## Commit Message
`feat(types): EmailNotificationConfig types`
