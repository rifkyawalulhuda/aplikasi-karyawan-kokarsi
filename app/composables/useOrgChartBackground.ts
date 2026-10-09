import type {
  OrgChartBackground, OrgChartBgPreset, OrgChartBgPattern,
} from '~/types/org-structure'

const STORAGE_KEY = 'org-chart-background'

const DEFAULTS: OrgChartBackground = {
  preset: 'light',
  customColor: '#e0e7ff',
  pattern: 'lines',
  gridSize: 24,
}

export interface OrgChartBgPresetDef {
  key: OrgChartBgPreset
  label: string
  color: string
  contrast: 'light' | 'dark' | 'auto'
}

export const ORG_BG_PRESETS: OrgChartBgPresetDef[] = [
  { key: 'light', label: 'Terang', color: '#f8fafc', contrast: 'light' },
  { key: 'dark', label: 'Gelap', color: '#0f172a', contrast: 'dark' },
  { key: 'paper', label: 'Kertas', color: '#f5f1e8', contrast: 'light' },
  { key: 'blueprint', label: 'Blueprint', color: '#0b2545', contrast: 'dark' },
  { key: 'custom', label: 'Kustom', color: '', contrast: 'auto' },
]

export const ORG_BG_PATTERNS: { key: OrgChartBgPattern; label: string; icon: string }[] = [
  { key: 'none', label: 'Tanpa pola', icon: 'i-lucide-ban' },
  { key: 'lines', label: 'Garis', icon: 'i-lucide-grid-3x3' },
  { key: 'dots', label: 'Titik', icon: 'i-lucide-grip' },
  { key: 'diagonal', label: 'Diagonal', icon: 'i-lucide-hash' },
]

// ── Utilitas warna ────────────────────────────────────────────────────────────
function normalizeHex(input: string): string {
  const h = (input || '').trim().replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(h)) return `#${h.split('').map(c => c + c).join('')}`
  if (/^[0-9a-f]{6}$/i.test(h)) return `#${h}`
  return '#ffffff'
}

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function isDarkColor(hex: string): boolean {
  const h = normalizeHex(hex).slice(1)
  const n = Number.parseInt(h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const lum = 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  return lum < 0.5
}

/**
 * Preferensi latar belakang kanvas bagan.
 * - State dibagikan lewat `useState` (aman untuk SSR).
 * - Pilihan pengguna dipersist ke localStorage (per-browser).
 */
export function useOrgChartBackground() {
  const background = useState<OrgChartBackground>('org-chart-background', () => ({ ...DEFAULTS }))

  const presetDef = computed<OrgChartBgPresetDef>(() =>
    ORG_BG_PRESETS.find(p => p.key === background.value.preset) ?? ORG_BG_PRESETS[0]!,
  )

  const bgColor = computed(() =>
    background.value.preset === 'custom'
      ? normalizeHex(background.value.customColor)
      : presetDef.value.color,
  )

  /** 'light' | 'dark' — dipakai untuk auto-kontras kartu. */
  const contrast = computed<'light' | 'dark'>(() => {
    if (presetDef.value.contrast !== 'auto') return presetDef.value.contrast
    return isDarkColor(bgColor.value) ? 'dark' : 'light'
  })

  /** Warna pola grid: otomatis kontras dengan latar. */
  const gridColor = computed(() =>
    contrast.value === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.09)',
  )

  /** Inline style untuk kanvas (warna + pola). */
  const canvasStyle = computed<Record<string, string>>(() => {
    const style: Record<string, string> = { backgroundColor: bgColor.value }
    const size = `${background.value.gridSize}px`
    const color = gridColor.value
    switch (background.value.pattern) {
      case 'lines':
        style.backgroundImage =
          `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`
        style.backgroundSize = `${size} ${size}`
        break
      case 'dots':
        style.backgroundImage = `radial-gradient(${color} 1px, transparent 1.5px)`
        style.backgroundSize = `${size} ${size}`
        break
      case 'diagonal':
        style.backgroundImage =
          `repeating-linear-gradient(45deg, ${color} 0 1px, transparent 1px ${size}), repeating-linear-gradient(-45deg, ${color} 0 1px, transparent 1px ${size})`
        break
      default:
        break
    }
    return style
  })

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(background.value))
    } catch {
      // localStorage tidak tersedia — abaikan.
    }
  }

  function hydrate() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<OrgChartBackground>
      background.value = {
        preset: ORG_BG_PRESETS.some(p => p.key === parsed.preset) ? parsed.preset! : DEFAULTS.preset,
        customColor: typeof parsed.customColor === 'string' ? parsed.customColor : DEFAULTS.customColor,
        pattern: ORG_BG_PATTERNS.some(p => p.key === parsed.pattern) ? parsed.pattern! : DEFAULTS.pattern,
        gridSize: typeof parsed.gridSize === 'number' ? parsed.gridSize : DEFAULTS.gridSize,
      }
    } catch {
      // Data rusak — pakai default.
    }
  }

  function patch(partial: Partial<OrgChartBackground>) {
    background.value = { ...background.value, ...partial }
    persist()
  }

  function setPreset(preset: OrgChartBgPreset) {
    patch({ preset })
  }

  function setCustomColor(color: string) {
    patch({ preset: 'custom', customColor: color })
  }

  function setPattern(pattern: OrgChartBgPattern) {
    patch({ pattern })
  }

  function setGridSize(size: number) {
    patch({ gridSize: size })
  }

  function reset() {
    background.value = { ...DEFAULTS }
    persist()
  }

  onMounted(hydrate)

  return {
    background,
    bgColor,
    contrast,
    canvasStyle,
    presetDef,
    presets: ORG_BG_PRESETS,
    patterns: ORG_BG_PATTERNS,
    setPreset,
    setCustomColor,
    setPattern,
    setGridSize,
    reset,
  }
}
