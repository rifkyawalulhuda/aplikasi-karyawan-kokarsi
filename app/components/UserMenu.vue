<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const auth = useAuthStore()
const colorMode = useColorMode()
const appConfig = useAppConfig()

const user = computed(() => ({
  name: auth.admin?.fullName ?? 'Master Admin',
  description: (auth.admin?.role ?? 'ADMIN') === 'PENGELOLA_KOPERASI' ? 'Pengelola Koperasi' : 'Admin',
  avatar: { alt: auth.admin?.fullName ?? 'Master Admin' }
}))

const colors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']
const neutrals = ['slate', 'gray', 'zinc', 'neutral', 'stone']

const items = computed<DropdownMenuItem[][]>(() => ([[{
  type: 'label',
  label: user.value.name,
  description: user.value.description,
  avatar: user.value.avatar
}], [{
  label: 'Profil',
  icon: 'i-lucide-user',
  to: '/settings'
}], [{
  label: 'Tampilan',
  icon: 'i-lucide-palette',
  children: [{
    label: 'Warna Utama',
    slot: 'chip',
    chip: appConfig.ui.colors.primary,
    content: { align: 'center', collisionPadding: 16 },
    children: colors.map(color => ({
      label: color,
      chip: color,
      slot: 'chip',
      checked: appConfig.ui.colors.primary === color,
      type: 'checkbox',
      onSelect: (e: Event) => {
        e.preventDefault()
        appConfig.ui.colors.primary = color
      }
    }))
  }, {
    label: 'Warna Netral',
    slot: 'chip',
    chip: appConfig.ui.colors.neutral === 'neutral' ? 'old-neutral' : appConfig.ui.colors.neutral,
    content: { align: 'end', collisionPadding: 16 },
    children: neutrals.map(color => ({
      label: color,
      chip: color === 'neutral' ? 'old-neutral' : color,
      slot: 'chip',
      type: 'checkbox',
      checked: appConfig.ui.colors.neutral === color,
      onSelect: (e: Event) => {
        e.preventDefault()
        appConfig.ui.colors.neutral = color
      }
    }))
  }]
}, {
  label: 'Mode Tampilan',
  icon: 'i-lucide-sun-moon',
  children: [{
    label: 'Terang',
    icon: 'i-lucide-sun',
    type: 'checkbox',
    checked: colorMode.value === 'light',
    onSelect(e: Event) {
      e.preventDefault()
      colorMode.preference = 'light'
    }
  }, {
    label: 'Gelap',
    icon: 'i-lucide-moon',
    type: 'checkbox',
    checked: colorMode.value === 'dark',
    onSelect(e: Event) {
      e.preventDefault()
      colorMode.preference = 'dark'
    }
  }]
}], [{
  label: 'Keluar',
  icon: 'i-lucide-log-out',
  onSelect() {
    auth.logout()
  }
}]]))
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        ...user,
        label: collapsed ? undefined : user?.name,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />

    <template #chip-leading="{ item }">
      <div class="inline-flex items-center justify-center shrink-0 size-5">
        <span
          class="rounded-full ring ring-bg bg-(--chip-light) dark:bg-(--chip-dark) size-2"
          :style="{
            '--chip-light': `var(--color-${(item as any).chip}-500)`,
            '--chip-dark': `var(--color-${(item as any).chip}-400)`
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>
