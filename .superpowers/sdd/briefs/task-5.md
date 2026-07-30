# Task 5: Daftarkan Tab di settings/index.vue

## Objective
Add the "Email Config" tab to the existing settings page so the `EmailConfigTab` component is accessible.

## File to Modify
- `app/pages/settings/index.vue`

## Exact Changes Required

### 1. Expand SettingsTab type (line ~317)
```typescript
// Before:
type SettingsTab = 'general' | 'profile' | 'login-appearance'

// After:
type SettingsTab = 'general' | 'profile' | 'login-appearance' | 'email-config'
```

### 2. Add tab entry to `tabs` computed (after the login-appearance entry)
The `tabs` computed already spreads `login-appearance` conditionally for `auth.canManageMasterData`. Add `email-config` the same way — only visible to ADMIN:

```typescript
const tabs = computed(() => [
  { key: 'general' as SettingsTab, label: 'Umum', icon: 'i-lucide-building-2' },
  { key: 'profile' as SettingsTab, label: 'Profil Akun', icon: 'i-lucide-user-cog' },
  ...(auth.canManageMasterData
    ? [
        { key: 'login-appearance' as SettingsTab, label: 'Tampilan Login', icon: 'i-lucide-monitor' },
        { key: 'email-config' as SettingsTab, label: 'Email Config', icon: 'i-lucide-mail' },
      ]
    : []),
])
```

### 3. Add tab content section in template (after the login-appearance div)
Find the comment `<!-- Tab: Tampilan Login -->` or similar in the template, and add after its closing `</div>`:

```html
<!-- Tab: Email Config -->
<div v-if="activeTab === 'email-config'">
  <EmailConfigTab />
</div>
```

## Notes
- `EmailConfigTab` component is auto-imported by Nuxt — no manual import needed
- The `i-lucide-mail` icon follows the same pattern as other tabs
- Both `login-appearance` and `email-config` are gated behind `auth.canManageMasterData`
- Make sure the `max-w-2xl` wrapper div covers the email-config tab content too (it should already since all tab content lives inside it)

## Verify
Visually confirm tab renders in browser. No TypeScript compile command available for frontend.

## Commit Message
`feat(frontend): daftarkan tab Email Config di settings page`
