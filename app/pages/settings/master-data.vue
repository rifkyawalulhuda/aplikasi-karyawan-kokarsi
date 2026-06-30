<script setup lang="ts">
</script>

<template>
  <UDashboardPanel id="settings-master-data">
    <template #header>
      <UDashboardNavbar title="Master Data">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <!-- Lokasi Kerja -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-map-pin" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Lokasi Kerja</span>
              </div>
              <UButton icon="i-lucide-plus" size="xs" variant="ghost" color="primary" />
            </div>
          </template>
          <ul class="space-y-2">
            <li
              v-for="item in ['Jakarta', 'Cikarang', 'Surabaya', 'Medan']"
              :key="item"
              class="flex items-center justify-between text-sm py-1 border-b border-default last:border-0"
            >
              <span class="text-highlighted">{{ item }}</span>
              <div class="flex gap-1">
                <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" />
                <UButton icon="i-lucide-trash" size="xs" variant="ghost" color="error" />
              </div>
            </li>
          </ul>
        </UCard>

        <!-- Jabatan -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-briefcase" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Jabatan (Job Role)</span>
              </div>
              <UButton icon="i-lucide-plus" size="xs" variant="ghost" color="primary" />
            </div>
          </template>
          <ul class="space-y-2">
            <li
              v-for="item in ['Operator', 'Supervisor', 'Staff Administrasi', 'Teknisi', 'Foreman']"
              :key="item"
              class="flex items-center justify-between text-sm py-1 border-b border-default last:border-0"
            >
              <span class="text-highlighted">{{ item }}</span>
              <div class="flex gap-1">
                <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" />
                <UButton icon="i-lucide-trash" size="xs" variant="ghost" color="error" />
              </div>
            </li>
          </ul>
        </UCard>

        <!-- Level Jabatan -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-layers" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Level Jabatan</span>
              </div>
              <UButton icon="i-lucide-plus" size="xs" variant="ghost" color="primary" />
            </div>
          </template>
          <ul class="space-y-2">
            <li
              v-for="item in ['Junior', 'Middle', 'Senior', 'Lead']"
              :key="item"
              class="flex items-center justify-between text-sm py-1 border-b border-default last:border-0"
            >
              <span class="text-highlighted">{{ item }}</span>
              <div class="flex gap-1">
                <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" />
                <UButton icon="i-lucide-trash" size="xs" variant="ghost" color="error" />
              </div>
            </li>
          </ul>
        </UCard>

        <!-- Status Pajak -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-receipt" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Status Pajak</span>
              </div>
              <UButton icon="i-lucide-plus" size="xs" variant="ghost" color="primary" />
            </div>
          </template>
          <ul class="space-y-2">
            <li
              v-for="item in ['TK/0', 'TK/1', 'K/0', 'K/1', 'K/2']"
              :key="item"
              class="flex items-center justify-between text-sm py-1 border-b border-default last:border-0"
            >
              <span class="text-highlighted">{{ item }}</span>
              <div class="flex gap-1">
                <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" />
                <UButton icon="i-lucide-trash" size="xs" variant="ghost" color="error" />
              </div>
            </li>
          </ul>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
