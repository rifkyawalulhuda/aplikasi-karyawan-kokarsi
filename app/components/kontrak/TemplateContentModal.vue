<script setup lang="ts">
import type { TemplateContentEditorState } from '~/composables/useTemplateContentEditor'

interface ContractTemplateMeta {
  id: number
  name: string
  templateKey: string
  family: 'PKWT' | 'MITRA'
}

const props = defineProps<{
  open: boolean
  template: ContractTemplateMeta | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const localOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const toast = useToast()
const { buildEditorState, buildOverridesPayload, countChanges, containsPlaceholder } = useTemplateContentEditor()

// --- State ---
const loading = ref(false)
const saving = ref(false)
const hardcoded = ref<any>(null)
const baseline = ref<TemplateContentEditorState | null>(null)
const editorState = ref<TemplateContentEditorState | null>(null)
const activeTab = ref('umum')

// --- Computed ---
const changesCount = computed(() => {
  if (!editorState.value || !baseline.value) return 0
  // Bandingkan dengan baseline (apa yang tersimpan saat modal dibuka),
  // bukan dengan hardcoded — sehingga tidak tampil "belum tersimpan" setelah save
  return countChanges(editorState.value, baseline.value)
})

const isPkwt = computed(() => props.template?.family === 'PKWT')

const tabItems = computed(() => {
  const base = [
    { label: 'Teks Umum', value: 'umum' },
    { label: isPkwt.value ? 'Pasal (Indonesia)' : 'Pasal-pasal', value: 'pasal-id' },
  ]
  if (isPkwt.value) {
    base.push({ label: 'Pasal (English)', value: 'pasal-en' })
  }
  return base
})

// englishSections sebagai array untuk iterasi yang type-safe
const englishSectionEntries = computed<Array<[string, string[]]>>(() => {
  if (!editorState.value) return []
  return Object.entries(editorState.value.englishSections) as Array<[string, string[]]>
})

// --- Load data saat template berubah ---
watch(() => props.template?.id, async (id) => {
  if (!id || !props.open) return
  await fetchContentPreview(id)
}, { immediate: false })

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.template?.id) {
    activeTab.value = 'umum'
    await fetchContentPreview(props.template.id)
  }
})

async function fetchContentPreview(id: number) {
  loading.value = true
  try {
    const res = await $fetch<any>(`/api/contract-templates/${id}/content-preview`)
    // hardcoded = teks asli (untuk Reset Tab ke Default)
    hardcoded.value = res.hardcoded
    // editorState dibangun dari merged (sudah include override tersimpan)
    editorState.value = buildEditorState(res.merged)
    // baseline = snapshot dari merged saat modal dibuka,
    // dipakai untuk diff "belum tersimpan" (bukan diff vs hardcode)
    baseline.value = buildEditorState(res.merged)
  }
  catch (e: any) {
    toast.add({ title: 'Gagal memuat konten template', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
    localOpen.value = false
  }
  finally {
    loading.value = false
  }
}

// --- Reset tab ke default ---
function resetTab() {
  if (!editorState.value || !hardcoded.value) return
  const fresh = buildEditorState(hardcoded.value)

  if (activeTab.value === 'umum') {
    editorState.value.title = fresh.title
    editorState.value.subtitle = fresh.subtitle
    editorState.value.roleLabel = fresh.roleLabel
    editorState.value.locationLine = fresh.locationLine
    editorState.value.termLine = fresh.termLine
    editorState.value.compensationLabel = fresh.compensationLabel
    editorState.value.firstPartyLabel = fresh.firstPartyLabel
    editorState.value.secondPartyLabel = fresh.secondPartyLabel
  }
  else if (activeTab.value === 'pendahuluan') {
    editorState.value.recitals = [...fresh.recitals]
    editorState.value.closingParagraphs = [...fresh.closingParagraphs]
  }
  else if (activeTab.value === 'pasal-id') {
    editorState.value.sections = fresh.sections.map(s => ({ ...s, paragraphs: [...s.paragraphs] }))
  }
  else if (activeTab.value === 'pasal-en') {
    editorState.value.englishSections = Object.fromEntries(
      Object.entries(fresh.englishSections).map(([k, v]) => [k, [...v]]),
    )
  }

  toast.add({ title: 'Tab direset ke default', color: 'info' })
}

// --- Simpan ---
async function save() {
  if (!editorState.value || !hardcoded.value || !props.template) return
  saving.value = true
  try {
    // buildOverridesPayload tetap dibandingkan dengan hardcoded
    // agar payload berisi semua perbedaan dari default asli
    const overrides = buildOverridesPayload(editorState.value, hardcoded.value)
    await $fetch(`/api/contract-templates/${props.template.id}/content-overrides`, {
      method: 'PUT',
      body: { overrides },
    })
    // Update baseline ke state saat ini agar changesCount kembali ke 0
    baseline.value = buildEditorState(editorState.value as any)
    toast.add({
      title: 'Konten template disimpan',
      description: `${Object.keys(overrides).length === 0 ? 'Tidak ada perubahan' : `${changesCount.value} perubahan`} tersimpan.`,
      color: 'success',
    })
    emit('saved')
    localOpen.value = false
  }
  catch (e: any) {
    toast.add({ title: 'Gagal menyimpan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  }
  finally {
    saving.value = false
  }
}

function formatHeading(heading: string) {
  return heading.replace('\n', ' — ')
}
</script>

<template>
  <UModal
    v-model:open="localOpen"
    :ui="{ content: 'max-w-4xl' }"
    :title="`Edit Konten Template: ${template?.name ?? ''}`"
    @update:open="(v) => { if (!v) localOpen = false }"
  >
    <template #body>
      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-3 text-muted">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
        <p class="text-sm">Memuat konten template...</p>
      </div>

      <div v-else-if="editorState" class="space-y-4">
        <!-- Dirty indicator -->
        <UAlert
          v-if="changesCount > 0"
          color="primary"
          variant="subtle"
          icon="i-lucide-pencil"
          :title="`${changesCount} field diubah dari default`"
          description="Perubahan belum tersimpan. Klik 'Simpan Perubahan' untuk menyimpan."
        />

        <!-- Warning tentang placeholder -->
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          title="Perhatian: Placeholder Dinamis"
          description="Jangan hapus placeholder seperti __TERM_DATE__, __WAGE_AMOUNT__, __MITRA_IMBALAN__ karena digunakan untuk mengisi data kontrak secara otomatis."
        />

        <!-- Tab navigation manual — menghindari UTabs DynamicSlots type issue -->
        <div class="border-b border-(--ui-border)">
          <nav class="flex gap-1 -mb-px">
            <button
              v-for="tab in tabItems"
              :key="tab.value"
              type="button"
              class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
              :class="activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-highlighted hover:border-(--ui-border)'"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
            </button>
          </nav>
        </div>

        <!-- Tab 1: Teks Umum -->
        <div v-if="activeTab === 'umum'" class="space-y-4 pt-2">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="Judul Dokumen">
              <UInput v-model="editorState.title" class="w-full" :placeholder="hardcoded?.title" />
            </UFormField>
          <!-- Sub-judul hanya untuk PKWT -->
          <UFormField v-if="isPkwt" label="Sub-judul (opsional)">
            <UInput v-model="editorState.subtitle" class="w-full" :placeholder="hardcoded?.subtitle ?? '-'" />
          </UFormField>
          </div>
          <UFormField label="Label Posisi / Peran">
            <UInput v-model="editorState.roleLabel" class="w-full" :placeholder="hardcoded?.roleLabel" />
          </UFormField>
        </div>

        <!-- Tab 2: Pendahuluan (hanya MITRA — recitals tidak dirender di dokumen PKWT) -->
        <div v-else-if="activeTab === 'pendahuluan'" class="space-y-6 pt-2">
          <!-- Info: teks pembuka tidak bisa diubah via UI -->
          <UAlert
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            title="Teks Pembuka Tidak Dapat Diubah"
            description="Teks pembuka (identitas Para Pihak, kalimat pembukaan) sudah terstandarisasi secara hukum dan diisi otomatis dari data sistem. Hanya Paragraf Penutup yang dapat dikustomisasi di sini."
          />

          <!-- Closing Paragraphs -->
          <div>
            <p class="text-sm font-semibold text-highlighted mb-3">
              Paragraf Penutup
            </p>
            <div class="space-y-2">
              <div
                v-for="(para, idx) in editorState.closingParagraphs"
                :key="idx"
              >
                <UTextarea
                  v-model="editorState.closingParagraphs[idx]"
                  :rows="2"
                  class="w-full"
                  :placeholder="hardcoded?.closingParagraphs?.[idx] ?? ''"
                />
                <UBadge
                  v-if="containsPlaceholder(para)"
                  color="warning"
                  variant="subtle"
                  size="xs"
                  class="mt-1"
                  label="Mengandung placeholder dinamis"
                  icon="i-lucide-alert-triangle"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Pasal Indonesia -->
        <div v-else-if="activeTab === 'pasal-id'" class="space-y-3 pt-2">
          <UAccordion
            :items="editorState.sections.map((s, idx) => ({
              label: formatHeading(s.heading),
              slot: `section-${idx}`,
              value: `section-${idx}`,
            }))"
          >
            <template
              v-for="(section, sIdx) in editorState.sections"
              :key="sIdx"
              #[`section-${sIdx}`]
            >
              <div class="space-y-2 py-3">
                <div
                  v-for="(para, pIdx) in section.paragraphs"
                  :key="pIdx"
                >
                  <UTextarea
                    v-model="editorState.sections[sIdx]!.paragraphs[pIdx]"
                    :rows="para.length > 100 ? 3 : 2"
                    class="w-full text-sm"
                    :placeholder="hardcoded?.sections?.[sIdx]?.paragraphs?.[pIdx] ?? ''"
                  />
                  <UBadge
                    v-if="containsPlaceholder(para)"
                    color="warning"
                    variant="subtle"
                    size="xs"
                    class="mt-0.5"
                    label="Placeholder dinamis — jangan hapus"
                    icon="i-lucide-alert-triangle"
                  />
                </div>
              </div>
            </template>
          </UAccordion>
        </div>

        <!-- Tab 4: Pasal English (hanya PKWT) -->
        <div v-else-if="activeTab === 'pasal-en' && isPkwt" class="space-y-3 pt-2">
          <UAccordion
            :items="englishSectionEntries.map(([heading], idx) => ({
              label: formatHeading(heading),
              slot: `eng-${idx}`,
              value: `eng-${idx}`,
            }))"
          >
            <template
              v-for="(entry, eIdx) in englishSectionEntries"
              :key="eIdx"
              #[`eng-${eIdx}`]
            >
              <div class="space-y-2 py-3">
                <div
                  v-for="(para, pIdx) in entry[1]"
                  :key="pIdx"
                >
                  <UTextarea
                    v-model="editorState.englishSections[entry[0]]![pIdx]"
                    :rows="para.length > 100 ? 3 : 2"
                    class="w-full text-sm"
                    :placeholder="hardcoded?.englishSections?.[entry[0]]?.[pIdx] ?? ''"
                  />
                  <UBadge
                    v-if="containsPlaceholder(para)"
                    color="warning"
                    variant="subtle"
                    size="xs"
                    class="mt-0.5"
                    label="Dynamic placeholder — do not remove"
                    icon="i-lucide-alert-triangle"
                  />
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-3 w-full">
        <div class="flex items-center gap-3">
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="localOpen = false"
          />
          <UButton
            label="Reset Tab ke Default"
            color="warning"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :disabled="loading || !editorState"
            @click="resetTab"
          />
        </div>
        <div class="flex items-center gap-3">
          <span v-if="changesCount > 0" class="text-xs text-muted">
            {{ changesCount }} field diubah
          </span>
          <UButton
            label="Simpan Perubahan"
            color="primary"
            icon="i-lucide-save"
            :loading="saving"
            :disabled="loading || !editorState"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
