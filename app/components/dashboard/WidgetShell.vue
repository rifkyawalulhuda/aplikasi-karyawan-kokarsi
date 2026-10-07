<script setup lang="ts">
import type { DashboardWidgetDef } from './registry'
import { DASHBOARD_CARD_UI } from './registry'

const props = withDefaults(defineProps<{
  widget: DashboardWidgetDef
  /** Ganti judul tampil (mis. saat menampilkan konteks periode). */
  titleOverride?: string
  /** Kelas padding body UCard (varian card). */
  bodyUi?: string
  /** `card` = satu UCard; `bare` = header polos + slot (untuk grup kartu). */
  variant?: 'card' | 'bare'
  /** Nonaktifkan tinggi penuh (default: h-full, hanya varian card). */
  autoHeight?: boolean
}>(), {
  variant: 'card'
})

const { editing, isVisible } = useDashboardLayout()

const title = computed(() => props.titleOverride ?? props.widget.title)
const hidden = computed(() => !isVisible(props.widget.id))
</script>

<template>
  <div
    :class="[
      widget.spanClass,
      'transition-opacity duration-200',
      editing && hidden ? 'opacity-45' : 'opacity-100'
    ]"
  >
    <!-- Varian kartu: satu UCard dengan header + body + footer -->
    <UCard
      v-if="variant === 'card'"
      :ui="{ ...DASHBOARD_CARD_UI, body: bodyUi ?? DASHBOARD_CARD_UI.body }"
      :class="autoHeight ? '' : 'h-full'"
    >
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <UIcon
              :name="editing ? 'i-lucide-grip-vertical' : widget.icon"
              class="size-4 shrink-0 text-muted"
              aria-hidden="true"
            />
            <span class="truncate text-sm font-semibold text-highlighted">{{ title }}</span>
            <slot name="badge" />
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <slot name="actions" />
            <DashboardWidgetEditControls :widget-id="widget.id" :title="title" />
          </div>
        </div>
      </template>

      <slot />

      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
    </UCard>

    <!-- Varian polos: header teks + slot (mis. grid beberapa kartu) -->
    <section v-else>
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <UIcon
            :name="editing ? 'i-lucide-grip-vertical' : widget.icon"
            class="size-4 shrink-0 text-muted"
            aria-hidden="true"
          />
          <span class="truncate text-sm font-semibold text-highlighted">{{ title }}</span>
          <slot name="badge" />
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <slot name="actions" />
          <DashboardWidgetEditControls :widget-id="widget.id" :title="title" />
        </div>
      </div>
      <slot />
    </section>
  </div>
</template>
