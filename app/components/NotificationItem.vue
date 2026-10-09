<script setup lang="ts">
import {
  notificationAbsoluteTime,
  notificationCategoryMeta,
  notificationCountdown,
  notificationCountdownColor,
  notificationRelativeTime
} from '~/utils/notification-meta'
import type { AppNotification } from '~/composables/useNotifications'

const props = defineProps<{
  item: AppNotification
  selectMode?: boolean
  selected?: boolean
  active?: boolean
  /** Sembunyikan aksi hover (sematkan/baca/singkirkan). */
  hideActions?: boolean
}>()

const emit = defineEmits<{
  'open': [AppNotification]
  'toggle-select': [AppNotification]
  'mark-read': [AppNotification]
  'mark-unread': [AppNotification]
  'pin': [AppNotification]
  'dismiss': [AppNotification]
}>()

const meta = computed(() => notificationCategoryMeta(props.item.category))
const countdown = computed(() => notificationCountdown(props.item.expiryDate))
const countdownColor = computed(() => notificationCountdownColor(props.item.expiryDate))

const showActions = computed(() => !props.hideActions && !props.selectMode)

function onPrimary() {
  if (props.selectMode) emit('toggle-select', props.item)
  else emit('open', props.item)
}
</script>

<template>
  <div
    class="group relative flex items-start gap-3 px-3 py-3 transition-colors"
    :class="[
      active ? 'bg-elevated' : 'hover:bg-elevated/60',
      !item.isRead ? 'bg-primary/5' : ''
    ]"
  >
    <!-- Aksen severity -->
    <span
      class="absolute inset-y-2 left-0 w-0.5 rounded-full"
      :class="item.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-400'"
    />

    <UCheckbox
      v-if="selectMode"
      class="mt-1 shrink-0"
      :model-value="Boolean(selected)"
      :aria-label="`Pilih ${item.title}`"
      @update:model-value="emit('toggle-select', item)"
    />

    <div
      class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
      :class="item.severity === 'CRITICAL'
        ? 'bg-red-500/10 text-red-500'
        : 'bg-amber-500/10 text-amber-500'"
    >
      <UIcon :name="meta.icon" class="size-4" />
    </div>

    <button type="button" class="min-w-0 flex-1 text-left" @click="onPrimary">
      <div class="flex items-center gap-1.5">
        <span
          v-if="!item.isRead"
          class="size-1.5 shrink-0 rounded-full bg-primary"
          aria-hidden="true"
        />
        <p class="truncate text-xs font-medium" :class="item.isRead ? 'text-muted' : 'text-highlighted'">
          {{ item.title }}
        </p>
        <UIcon v-if="item.pinnedAt" name="i-lucide-pin" class="size-3 shrink-0 text-primary" />
      </div>
      <p class="mt-0.5 line-clamp-2 text-xs text-muted">
        {{ item.message }}
      </p>
      <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <UBadge
          :label="meta.short"
          :color="meta.color"
          variant="subtle"
          size="sm"
        />
        <span
          v-if="countdown"
          class="text-[10px] font-medium"
          :class="{
            'text-red-500': countdownColor === 'error',
            'text-amber-500': countdownColor === 'warning',
            'text-muted': countdownColor === 'neutral'
          }"
        >
          {{ countdown }}
        </span>
        <span class="text-[10px] text-muted" :title="notificationAbsoluteTime(item.createdAt)">
          {{ notificationRelativeTime(item.createdAt) }}
        </span>
      </div>
    </button>

    <div
      v-if="showActions"
      class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
    >
      <UTooltip :text="item.pinnedAt ? 'Lepas sematan' : 'Sematkan'">
        <UButton
          :icon="item.pinnedAt ? 'i-lucide-pin-off' : 'i-lucide-pin'"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="item.pinnedAt ? 'Lepas sematan' : 'Sematkan'"
          @click.stop="emit('pin', item)"
        />
      </UTooltip>
      <UTooltip :text="item.isRead ? 'Tandai belum dibaca' : 'Tandai dibaca'">
        <UButton
          :icon="item.isRead ? 'i-lucide-mail' : 'i-lucide-mail-open'"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="item.isRead ? 'Tandai belum dibaca' : 'Tandai dibaca'"
          @click.stop="item.isRead ? emit('mark-unread', item) : emit('mark-read', item)"
        />
      </UTooltip>
      <UTooltip text="Singkirkan">
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="Singkirkan"
          @click.stop="emit('dismiss', item)"
        />
      </UTooltip>
    </div>
  </div>
</template>
