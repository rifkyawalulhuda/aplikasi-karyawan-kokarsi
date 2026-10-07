<script setup lang="ts">
/**
 * Pemicu Global Search yang terlihat.
 *
 * Sebelumnya pencarian hanya bisa dibuka lewat ikon kecil + Ctrl K, sehingga
 * banyak pengguna tidak tahu fitur ini ada. Tombol ini menyerupai field
 * pencarian saat sidebar terbuka (discoverable) dan menyusut jadi ikon di rail
 * saat ditutup, konsisten dengan item sidebar lain.
 */
defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <UTooltip :disabled="!collapsed" text="Cari (Ctrl K)" :content="{ side: 'right' }">
    <UButton
      v-if="collapsed"
      icon="i-lucide-search"
      color="neutral"
      variant="ghost"
      square
      aria-label="Cari (Ctrl K)"
      @click="emit('open')"
    />
    <UButton
      v-else
      color="neutral"
      variant="soft"
      block
      class="justify-start gap-2 font-normal"
      aria-label="Cari (Ctrl K)"
      @click="emit('open')"
    >
      <template #leading>
        <UIcon name="i-lucide-search" class="size-4 text-muted" />
      </template>
      <span class="flex-1 text-left text-sm text-muted">Cari…</span>
      <template #trailing>
        <span class="flex items-center gap-0.5">
          <UKbd value="ctrl" />
          <UKbd>K</UKbd>
        </span>
      </template>
    </UButton>
  </UTooltip>
</template>
