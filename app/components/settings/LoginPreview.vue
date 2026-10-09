<script setup lang="ts">
import type { LoginFeatureItem } from '~/types'

const device = defineModel<'desktop' | 'mobile'>('device', { default: 'desktop' })

const props = withDefaults(defineProps<{
  leftBgColor?: string
  rightBgColor?: string
  leftImageUrl?: string
  rightImageUrl?: string
  leftOverlayOpacity?: number
  rightOverlayOpacity?: number
  leftTextColor?: string
  rightTextColor?: string
  tagline?: string
  features?: LoginFeatureItem[]
  ornamentsEnabled?: boolean
  showVersion?: boolean
  appVersion?: string
  supportContact?: string
}>(), {
  leftBgColor: '',
  rightBgColor: '',
  leftImageUrl: '',
  rightImageUrl: '',
  leftOverlayOpacity: 7,
  rightOverlayOpacity: 0,
  leftTextColor: '',
  rightTextColor: '',
  tagline: 'Sistem Manajemen Karyawan',
  features: () => [],
  ornamentsEnabled: true,
  showVersion: true,
  appVersion: '1.0.0',
  supportContact: ''
})

const leftStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.leftBgColor) style.backgroundColor = props.leftBgColor
  if (props.leftImageUrl) {
    style.backgroundImage = `url('${props.leftImageUrl}')`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  return style
})

const rightStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.rightBgColor) style.backgroundColor = props.rightBgColor
  if (props.rightImageUrl) {
    style.backgroundImage = `url('${props.rightImageUrl}')`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  return style
})

const leftTextStyle = computed(() => props.leftTextColor ? { color: props.leftTextColor } : {})
const rightTextStyle = computed(() => props.rightTextColor ? { color: props.rightTextColor } : {})

const previewFeatures = computed<LoginFeatureItem[]>(() => {
  if (props.features.length) return props.features.slice(0, 3)
  return [
    { icon: 'i-lucide-users', text: 'Manajemen Data Karyawan' },
    { icon: 'i-lucide-file-text', text: 'Administrasi Kontrak Kerja' },
    { icon: 'i-lucide-bar-chart-3', text: 'Laporan & Ekspor Data' }
  ]
})

const isMobile = computed(() => device.value === 'mobile')
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-muted">Preview</span>
      <div class="flex items-center gap-1 rounded-lg border border-default p-0.5">
        <UButton
          icon="i-lucide-monitor"
          size="xs"
          :color="device === 'desktop' ? 'primary' : 'neutral'"
          :variant="device === 'desktop' ? 'soft' : 'ghost'"
          aria-label="Tampilan desktop"
          @click="device = 'desktop'"
        />
        <UButton
          icon="i-lucide-smartphone"
          size="xs"
          :color="device === 'mobile' ? 'primary' : 'neutral'"
          :variant="device === 'mobile' ? 'soft' : 'ghost'"
          aria-label="Tampilan mobile"
          @click="device = 'mobile'"
        />
      </div>
    </div>

    <div
      class="mx-auto overflow-hidden rounded-xl border border-default transition-all duration-300"
      :class="isMobile ? 'w-52 h-80' : 'w-full h-72'"
    >
      <div class="flex h-full" :class="isMobile ? 'flex-col' : 'flex-row'">
        <!-- Left / top panel -->
        <div
          class="relative overflow-hidden flex flex-col justify-between p-3"
          :class="isMobile ? 'h-1/3' : 'w-1/2'"
          :style="leftStyle"
        >
          <div
            class="pointer-events-none absolute inset-0"
            :style="{ backgroundColor: `rgba(0,0,0,${(leftOverlayOpacity ?? 0) / 100})` }"
          />
          <template v-if="ornamentsEnabled">
            <div class="pointer-events-none absolute -top-8 -left-6 size-20 rounded-full bg-white/10 blur-2xl" />
          </template>

          <div class="relative z-10 flex items-center gap-1.5">
            <div class="size-4 rounded bg-white/25 shrink-0" />
            <div class="h-1.5 w-12 rounded bg-white/60" />
          </div>

          <div class="relative z-10 space-y-1.5">
            <p class="text-[10px] font-bold leading-tight line-clamp-2" :style="leftTextStyle || { color: 'rgba(255,255,255,0.95)' }">
              {{ tagline }}
            </p>
            <div class="space-y-1">
              <div v-for="(f, i) in previewFeatures" :key="i" class="flex items-center gap-1">
                <div class="size-2.5 rounded bg-white/25 shrink-0" />
                <div class="h-1 flex-1 max-w-24 rounded bg-white/40" />
              </div>
            </div>
          </div>
        </div>

        <!-- Right / bottom panel -->
        <div
          class="relative overflow-hidden flex flex-col justify-center gap-1.5 p-3"
          :class="isMobile ? 'flex-1' : 'w-1/2'"
          :style="rightStyle"
        >
          <div
            class="pointer-events-none absolute inset-0"
            :style="{ backgroundColor: `rgba(0,0,0,${(rightOverlayOpacity ?? 0) / 100})` }"
          />
          <template v-if="ornamentsEnabled">
            <div class="pointer-events-none absolute -bottom-8 -right-6 size-20 rounded-full bg-primary/15 blur-2xl" />
          </template>

          <div class="relative z-10 space-y-1.5">
            <div class="h-2 w-20 rounded bg-muted" :style="rightTextStyle" />
            <div class="h-4 w-full rounded border border-default bg-elevated" />
            <div class="h-4 w-full rounded border border-default bg-elevated" />
            <div class="h-1 w-16 rounded bg-muted" />
            <div class="h-4 w-full rounded bg-primary" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10px] text-muted">
      <span v-if="showVersion">Versi {{ appVersion }}</span>
      <template v-if="showVersion && supportContact">
        <span aria-hidden="true">·</span>
      </template>
      <span v-if="supportContact">{{ supportContact }}</span>
    </div>
  </div>
</template>
