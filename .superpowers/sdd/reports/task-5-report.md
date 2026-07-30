# Task 5 Report: Daftarkan Tab di settings/index.vue

**Status:** DONE

## Commits Created

- `cc1b10b` feat(frontend): daftarkan tab Email Config di settings page

## Changes Made

Three changes applied to `app/pages/settings/index.vue`:

1. **SettingsTab type expanded** (line ~317): Added `'email-config'` to the union type.
2. **tabs computed updated**: Added `email-config` entry alongside `login-appearance` inside the `auth.canManageMasterData` conditional spread, with icon `i-lucide-mail`.
3. **Template tab content added**: Inserted `<div v-else-if="activeTab === 'email-config'"><EmailConfigTab /></div>` after the login-appearance `</div>` closing tag, inside the `max-w-2xl` wrapper.

`EmailConfigTab` relies on Nuxt auto-import — no manual import statement added.

## Summary

Registered the Email Config tab in the settings page so it appears for admin users and renders `EmailConfigTab` when active.

## Report File

`E:\Github\aplikasi-karyawan-kokarsi\.superpowers\sdd\reports\task-5-report.md`
