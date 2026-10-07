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
const drag = useDashboardDragContext()

const title = computed(() => props.titleOverride ?? props.widget.title)
const hidden = computed(() => !isVisible(props.widget.id))

/** Sedang diangkat (pointer drag atau mode grab keyboard). */
const lifted = computed(() =>
  drag?.activeId.value === props.widget.id || drag?.grabbedId.value === props.widget.id
)

function onHandleDown(e: PointerEvent) {
  drag?.onHandlePointerDown(e, props.widget.id)
}
function onHandleKeydown(e: KeyboardEvent) {
  drag?.onHandleKeyDown(e, props.widget.id)
}
</script>

<template>
  <div
    :data-widget-id="widget.id"
    :data-flip-key="widget.id"
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
      :class="[
        autoHeight ? '' : 'h-full',
        lifted ? 'ring-2 ring-primary ring-dashed' : ''
      ]"
    >
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <button
              v-if="editing"
              type="button"
              class="dashboard-drag-handle -ml-1 flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted transition-colors hover:bg-accented/60 hover:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
              :aria-label="`Tahan dan geser ${title} untuk mengubah urutan`"
              :aria-pressed="lifted"
              @pointerdown="onHandleDown"
              @keydown="onHandleKeydown"
            >
              <UIcon name="i-lucide-grip-vertical" class="size-4" aria-hidden="true" />
            </button>
            <UIcon
              v-else
              :name="widget.icon"
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
    <section
      v-else
      :class="lifted ? 'rounded-lg ring-2 ring-primary ring-dashed' : ''"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <button
            v-if="editing"
            type="button"
            class="dashboard-drag-handle -ml-1 flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted transition-colors hover:bg-accented/60 hover:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
            :aria-label="`Tahan dan geser ${title} untuk mengubah urutan`"
            :aria-pressed="lifted"
            @pointerdown="onHandleDown"
            @keydown="onHandleKeydown"
          >
            <UIcon name="i-lucide-grip-vertical" class="size-4" aria-hidden="true" />
          </button>
          <UIcon
            v-else
            :name="widget.icon"
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
