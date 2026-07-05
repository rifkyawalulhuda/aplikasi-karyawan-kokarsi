<script setup lang="ts">
import type { WarningLetter } from '~/types'

const props = defineProps<{
  letters: WarningLetter[]
}>()

function formatDate(val: string | undefined) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const levelLabelMap: Record<number, string> = {
  1: 'SP 1',
  2: 'SP 2',
  3: 'SP 3',
}

const levelColorMap: Record<number, string> = {
  1: 'warning',
  2: 'error',
  3: 'error',
}

const levelDotColorMap: Record<number, string> = {
  1: 'bg-warning',
  2: 'bg-error',
  3: 'bg-error',
}

function isExpired(letter: WarningLetter): boolean {
  return new Date(letter.validUntil) < new Date()
}

const sorted = computed(() =>
  [...props.letters].sort((a, b) => new Date(b.letterDate).getTime() - new Date(a.letterDate).getTime())
)
</script>

<template>
  <div>
    <h2 class="text-base font-semibold text-highlighted mb-3">
      Riwayat Surat Peringatan
      <span class="ml-1 text-sm font-normal text-muted">({{ letters.length }})</span>
    </h2>

    <div v-if="sorted.length === 0" class="text-sm text-muted py-4 text-center">
      Belum ada riwayat surat peringatan.
    </div>

    <div v-else class="relative">
      <!-- Scrollable container -->
      <div class="max-h-[400px] lg:max-h-[600px] overflow-y-auto pr-2 relative">
        <!-- Timeline line -->
        <div class="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div class="space-y-4 pb-4">
          <div
            v-for="letter in sorted"
            :key="letter.id"
            class="relative pl-10"
          >
            <!-- Timeline dot -->
            <div
              class="absolute left-3 top-4 w-2.5 h-2.5 rounded-full border-2 border-background"
              :class="levelDotColorMap[letter.warningLevel] ?? 'bg-muted'"
            />

            <div class="p-4 rounded-lg bg-default border border-default">
              <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <p class="font-mono text-sm font-medium text-highlighted">{{ letter.letterNumber }}</p>
                  <p class="text-xs text-muted">Oleh: {{ letter.processedByName }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge :color="(levelColorMap[letter.warningLevel] ?? 'neutral') as any" variant="subtle" size="sm">
                    {{ levelLabelMap[letter.warningLevel] ?? `SP ${letter.warningLevel}` }}
                  </UBadge>
                  <UBadge v-if="isExpired(letter)" color="neutral" variant="subtle" size="sm">
                    Expired
                  </UBadge>
                </div>
              </div>

              <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted mb-2">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
                  {{ formatDate(letter.letterDate) }} — {{ formatDate(letter.validUntil) }}
                </span>
              </div>

              <div v-if="letter.violationType?.length" class="flex flex-wrap gap-1.5 mb-2">
                <span
                  v-for="(violation, idx) in letter.violationType"
                  :key="idx"
                  class="inline-flex items-center text-xs px-2 py-0.5 rounded-md bg-elevated text-muted"
                >
                  {{ violation }}
                </span>
              </div>

              <a
                v-if="letter.documentUrl"
                :href="`http://localhost:3001${letter.documentUrl}`"
                target="_blank"
                class="flex items-center gap-1 text-primary hover:underline text-sm"
              >
                <UIcon name="i-lucide-file-text" class="w-3.5 h-3.5" />
                Dokumen
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Gradient fade indicator (dark mode aware) -->
      <div class="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-default to-transparent pointer-events-none" />
    </div>
  </div>
</template>
