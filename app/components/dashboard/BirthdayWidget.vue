<script setup lang="ts">
import { DASHBOARD_WIDGET_MAP } from './registry'

const widget = DASHBOARD_WIDGET_MAP.birthdays!
const { engagement, pending } = useDashboardEngagement()

// Skeleton sampai mount supaya SSR & hydration identik (fetch lazy).
const mounted = useMounted()
const isLoading = computed(() => pending.value || !mounted.value)

const tab = ref<'birthday' | 'anniversary'>('birthday')

const birthdays = computed(() => engagement.value?.birthdays ?? [])
const anniversaries = computed(() => engagement.value?.anniversaries ?? [])

const monthName = computed(() => {
  const month = engagement.value?.month ?? (new Date().getMonth() + 1)
  return new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2026, month - 1, 1))
})

const list = computed(() => tab.value === 'birthday' ? birthdays.value : anniversaries.value)
const totalCount = computed(() => birthdays.value.length + anniversaries.value.length)
</script>

<template>
  <DashboardWidgetShell :widget="widget" :body-ui="'p-0'">
    <template #badge>
      <span
        v-if="totalCount > 0"
        class="inline-flex items-center rounded-full bg-pink-500/10 px-2 py-0.5 text-xs font-semibold text-pink-500"
      >{{ totalCount }} di {{ monthName }}</span>
    </template>

    <div class="flex items-center gap-1 border-b border-default px-4 pb-2">
      <button
        type="button"
        class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
        :class="tab === 'birthday' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-highlighted'"
        :aria-pressed="tab === 'birthday'"
        @click="tab = 'birthday'"
      >
        Ulang Tahun ({{ birthdays.length }})
      </button>
      <button
        type="button"
        class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
        :class="tab === 'anniversary' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-highlighted'"
        :aria-pressed="tab === 'anniversary'"
        @click="tab = 'anniversary'"
      >
        Anniversary ({{ anniversaries.length }})
      </button>
    </div>

    <div class="max-h-72 overflow-y-auto p-4 pt-3">
      <div v-if="isLoading" class="space-y-2">
        <div v-for="i in 3" :key="`bd-skel-${i}`" class="h-9 animate-pulse rounded bg-accented" />
      </div>

      <div v-else-if="list.length === 0" class="flex flex-col items-center gap-2 py-8 text-muted">
        <UIcon :name="tab === 'birthday' ? 'i-lucide-cake' : 'i-lucide-party-popper'" class="size-8 opacity-40" />
        <p class="text-sm">
          Tidak ada {{ tab === 'birthday' ? 'ulang tahun' : 'anniversary' }} di {{ monthName }}
        </p>
      </div>

      <ul v-else class="divide-y divide-default">
        <li v-for="person in list" :key="person.id" class="flex items-center gap-3 py-2">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-xs font-semibold text-pink-500 tabular-nums">
            {{ person.day }}
          </span>
          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/karyawan/${person.id}`"
              class="block truncate text-sm font-medium text-highlighted hover:text-primary"
            >{{ person.fullName }}</NuxtLink>
            <p class="truncate text-xs text-muted">
              {{ person.jobRole ?? '—' }}<span v-if="person.workLocation"> · {{ person.workLocation }}</span>
            </p>
          </div>
          <UBadge
            v-if="tab === 'anniversary' && person.years"
            :label="`${person.years} thn`"
            color="primary"
            variant="subtle"
            size="sm"
          />
        </li>
      </ul>
    </div>
  </DashboardWidgetShell>
</template>
