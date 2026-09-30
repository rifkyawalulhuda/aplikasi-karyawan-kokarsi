<script setup lang="ts">
interface Template { id: number, name: string, family: 'PKWT' | 'MITRA' }
interface Version { id: number, versionNumber: number, status: string, contentDefinition: any, fieldDefinitions: any, changeSummary?: string }
const props = defineProps<{ open: boolean, template: Template | null }>(); const emit = defineEmits<{ 'update:open': [boolean], 'saved': [] }>()
const open = computed({ get: () => props.open, set: v => emit('update:open', v) }); const toast = useToast()
const loading = ref(false), saving = ref(false), busy = ref(false), error = ref(''); const versions = ref<Version[]>([]), selected = ref<Version | null>(null), draft = ref<Version | null>(null), fields = ref<any[]>([])
const lang = ref<'id' | 'en'>('id'); const preview = ref<any>(null); const previewOpen = ref(false); const fieldOpen = ref(false); const fieldSaving = ref(false)
const form = reactive({ key: '', label: '', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT', options: '' })
const isPkwt = computed(() => props.template?.family === 'PKWT'); const blocks = computed<any[]>({ get: () => draft.value?.contentDefinition?.languages?.[lang.value] ?? selected.value?.contentDefinition?.languages?.[lang.value] ?? [], set: (v) => { if (draft.value)draft.value.contentDefinition.languages[lang.value] = v } })
const fieldItems = computed(() => fields.value.length ? fields.value : (Array.isArray(draft.value?.fieldDefinitions) ? draft.value?.fieldDefinitions : draft.value?.fieldDefinitions?.fields ?? []))
const placeholderText = (key: string) => `{{${key}}}`
const previewValues: Record<string, string> = {
  'employee.fullName': 'Budi Santoso', 'employee.employeeNo': 'KOK-0001', 'employee.jobRole': 'Staff Operasional',
  'contract.startDate': '1 Januari 2026', 'contract.endDate': '31 Desember 2026', 'contract.salary': 'Rp5.000.000',
  'company.name': 'Koperasi Karyawan Kokarsi', 'contract.number': 'PKWT/001/2026',
  'coop.chairmanName': 'Ahmad Fauzi'
}
function previewText(value: any) { return String(value ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => previewValues[key] ?? `«${key}»`) }
const previewBlocks = computed(() => blocks.value)
/** Blok title pertama jadi judul tengah dokumen (mengikuti drawTitleBlock renderer PDF). */
const titleBlock = computed(() => blocks.value.find(b => b.type === 'title') as any)
const subtitleBlock = computed(() => blocks.value.find(b => b.type === 'subtitle') as any)
const docTitle = computed(() => previewText(titleBlock.value?.text ?? ''))
const docSubtitle = computed(() => previewText(subtitleBlock.value?.text ?? ''))
const cloneVersion = (value: Version): Version => JSON.parse(JSON.stringify(value))
watch(() => props.open, (v) => { if (v && props.template)load() }); watch(() => props.template?.id, (v) => { if (v && props.open)load() })
async function load() { if (!props.template) return; loading.value = true; error.value = ''; try { const [vs, fs] = await Promise.all([$fetch<Version[]>(`/api/contract-templates/${props.template.id}/versions`), $fetch<any[]>('/api/template-fields')]); versions.value = vs ?? []; fields.value = fs ?? []; await select(versions.value.find(v => v.status === 'DRAFT') ?? versions.value.find(v => v.status === 'PUBLISHED') ?? versions.value[0]) } catch (e: any) { error.value = apiErrorMessage(e, 'Gagal memuat versi') } finally { loading.value = false } }
async function select(v?: Version) { if (!v) return; selected.value = await $fetch<Version>(`/api/contract-template-versions/${v.id}`); draft.value = selected.value.status === 'DRAFT' ? cloneVersion(selected.value) : null }
async function createDraft() { if (!props.template || draft.value) return; busy.value = true; try { const v = await $fetch<Version>(`/api/contract-templates/${props.template.id}/versions`, { method: 'POST', body: { changeSummary: 'Draft baru dari editor' } }); versions.value = [v, ...versions.value]; await select(v) } catch (e: any) { toast.add({ title: 'Draft gagal dibuat', description: apiErrorMessage(e), color: 'error' }) } finally { busy.value = false } }
async function save() { if (!draft.value) return; saving.value = true; try { const v = await $fetch<Version>(`/api/contract-template-versions/${draft.value.id}`, { method: 'PUT', body: { contentDefinition: draft.value.contentDefinition, fieldDefinitions: draft.value.fieldDefinitions, changeSummary: draft.value.changeSummary || 'Perubahan editor' } }); draft.value = cloneVersion(v); selected.value = v; versions.value = versions.value.map(x => x.id === v.id ? v : x); toast.add({ title: 'Draft tersimpan', color: 'success' }) } catch (e: any) { toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' }) } finally { saving.value = false } }
async function action(name: 'preview' | 'publish' | 'rollback') { const v = draft.value ?? selected.value; if (!v) return; busy.value = true; try { if (name === 'preview' && draft.value) await save(); const r = await $fetch<any>(`/api/contract-template-versions/${v.id}/${name}`, { method: 'POST' }); if (name === 'preview') { preview.value = r; previewOpen.value = true } else { toast.add({ title: name === 'publish' ? 'Versi dipublish' : 'Rollback berhasil', color: 'success' }); await load(); emit('saved') } } catch (e: any) { toast.add({ title: 'Aksi gagal', description: apiErrorMessage(e), color: 'error' }) } finally { busy.value = false } }
function add(type: string) { const id = `${type}-${Date.now()}`; const d: any = { paragraph: { id, type, text: '' }, article: { id, type, heading: 'Pasal baru', paragraphs: [''] }, list: { id, type, style: 'bullet', items: [''] }, table: { id, type, columns: [{ key: 'value', label: 'Nilai', width: 100, format: 'text' }], rows: [{ value: '' }] }, pageBreak: { id, type }, signature: { id, type, leftRole: 'Pihak Pertama', rightRole: 'Pihak Kedua' } }; blocks.value.push(d[type]) }
function move(i: number, d: number) { const j = i + d; if (j < 0 || j >= blocks.value.length) return; const x = blocks.value.splice(i, 1)[0]; blocks.value.splice(j, 0, x) }
function useField(key: string) { const b = blocks.value[0]; if (!b) return; const text = `{{${key}}}`; if (b.type === 'article')b.paragraphs[0] = (b.paragraphs[0] ?? '') + ` ${text}`; else if (b.type === 'list')b.items[0] = (b.items[0] ?? '') + ` ${text}`; else b.text = (b.text ?? '') + ` ${text}` }
async function createField() { fieldSaving.value = true; try { const f = await $fetch<any>('/api/template-fields', { method: 'POST', body: { key: form.key, label: form.label, dataType: form.dataType, sourceType: form.sourceType, options: form.dataType === 'DROPDOWN' ? form.options.split(',').map(x => x.trim()).filter(Boolean) : undefined } }); fields.value.push(f); fieldOpen.value = false; toast.add({ title: 'Field dibuat', color: 'success' }) } catch (e: any) { toast.add({ title: 'Field gagal dibuat', description: apiErrorMessage(e), color: 'error' }) } finally { fieldSaving.value = false } }
const color = (s: string) => s === 'PUBLISHED' ? 'success' : s === 'DRAFT' ? 'warning' : 'neutral'
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Editor Template — ${template?.name ?? ''}`"
    :ui="{ content: 'max-w-7xl w-full' }"
  >
    <template #body>
      <div v-if="error" class="space-y-3 p-4">
        <p>{{ error }}</p>
        <UButton label="Coba lagi" @click="load" />
      </div>

      <div v-else-if="loading" class="flex justify-center p-12">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
      </div>

      <div v-else class="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <!-- Riwayat versi -->
        <aside class="space-y-3">
          <div class="flex justify-between">
            <b>Riwayat versi</b>
            <UButton
              v-if="!draft"
              size="xs"
              label="Draft"
              icon="i-lucide-plus"
              :loading="busy"
              @click="createDraft"
            />
          </div>
          <div
            v-for="v in versions"
            :key="v.id"
            class="cursor-pointer rounded border p-3"
            :class="selected?.id===v.id?'border-primary bg-primary/5':'border-default'"
            @click="select(v)"
          >
            <div class="flex justify-between">
              <b>v{{ v.versionNumber }}</b>
              <UBadge :color="color(v.status)" :label="v.status" />
            </div>
            <p class="text-xs text-muted">
              {{ v.changeSummary||'Tanpa ringkasan' }}
            </p>
            <UButton
              v-if="v.status==='ARCHIVED'"
              size="xs"
              label="Rollback"
              variant="ghost"
              @click.stop="select(v).then(() => action('rollback'))"
            />
          </div>
        </aside>

        <!-- Editor blok -->
        <main class="min-w-0 space-y-4">
          <div class="flex flex-wrap justify-between gap-2">
            <div>
              <b>{{ draft?'Draft':'Versi' }} v{{ (draft??selected)?.versionNumber }}</b>
              <p class="text-xs text-muted">
                {{ draft?'Perubahan belum dipublish':'Mode baca' }}
              </p>
            </div>
            <div class="flex gap-2">
              <UButton
                label="Preview"
                icon="i-lucide-eye"
                variant="soft"
                :loading="busy"
                @click="action('preview')"
              />
              <UButton
                v-if="draft"
                label="Publish"
                icon="i-lucide-rocket"
                color="primary"
                :loading="busy"
                @click="action('publish')"
              />
            </div>
          </div>

          <UInput v-if="draft" v-model="draft.changeSummary" placeholder="Ringkasan perubahan" />

          <div class="flex gap-1 border-b border-default">
            <UButton
              label="Indonesia"
              size="sm"
              :variant="lang==='id'?'soft':'ghost'"
              @click="lang='id'"
            />
            <UButton
              v-if="isPkwt"
              label="English"
              size="sm"
              :variant="lang==='en'?'soft':'ghost'"
              @click="lang='en'"
            />
          </div>

          <div class="space-y-3 rounded-xl border border-default p-3">
            <div
              v-for="(b, i) in blocks"
              :key="b.id"
              class="space-y-2 rounded-lg border border-default p-3"
            >
              <div class="flex items-center gap-2">
                <UBadge :label="b.type" />
                <span class="text-xs text-muted">{{ b.id }}</span>
                <div class="ml-auto">
                  <UButton
                    size="xs"
                    icon="i-lucide-arrow-up"
                    variant="ghost"
                    :disabled="!draft||i===0"
                    @click="move(i, -1)"
                  />
                  <UButton
                    size="xs"
                    icon="i-lucide-arrow-down"
                    variant="ghost"
                    :disabled="!draft||i===blocks.length-1"
                    @click="move(i, 1)"
                  />
                  <UButton
                    size="xs"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    :disabled="!draft"
                    @click="blocks.splice(i, 1)"
                  />
                </div>
              </div>

              <UInput
                v-if="['title', 'subtitle', 'paragraph'].includes(b.type)"
                v-model="b.text"
                :disabled="!draft"
              />
              <template v-else-if="b.type==='article'">
                <UInput v-model="b.heading" :disabled="!draft" />
                <UTextarea
                  v-for="(_, p) in b.paragraphs"
                  :key="p"
                  v-model="b.paragraphs[p]"
                  :disabled="!draft"
                  :rows="3"
                />
              </template>

              <template v-else-if="b.type==='list'">
                <USelect
                  v-model="b.style"
                  :disabled="!draft"
                  :items="['bullet', 'numbered', 'alphabetic']"
                />
                <UInput
                  v-for="(_, p) in b.items"
                  :key="p"
                  v-model="b.items[p]"
                  :disabled="!draft"
                />
              </template>

              <template v-else-if="b.type==='table'">
                <div class="overflow-auto">
                  <table class="w-full">
                    <thead>
                      <tr>
                        <th v-for="c in b.columns" :key="c.key">
                          <UInput v-model="c.label" :disabled="!draft" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(r, n) in b.rows" :key="n">
                        <td v-for="c in b.columns" :key="c.key">
                          <UInput v-model="r[c.key]" :disabled="!draft" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>

              <div v-else-if="b.type==='signature'" class="grid grid-cols-2 gap-2">
                <UInput v-model="b.leftRole" :disabled="!draft" />
                <UInput v-model="b.rightRole" :disabled="!draft" />
              </div>

              <div v-else class="text-sm text-muted">
                Page break
              </div>
            </div>

            <div v-if="draft" class="flex flex-wrap gap-2 border border-dashed border-default p-3">
              <span class="self-center text-xs">Tambah:</span>
              <UButton
                v-for="t in ['paragraph', 'article', 'list', 'table', 'pageBreak', 'signature']"
                :key="t"
                size="sm"
                variant="soft"
                :label="t"
                @click="add(t)"
              />
            </div>
          </div>
        </main>

        <!-- Preview live + fields -->
        <aside class="space-y-3">
          <div class="flex items-center justify-between">
            <b>Preview dokumen</b>
            <span class="text-xs text-muted">contoh data</span>
          </div>
          <div class="max-h-[70vh] overflow-auto rounded-lg bg-neutral-200 p-3">
            <KontrakDocumentPreview
              :blocks="blocks"
              :values="previewValues"
              :title="docTitle"
              :subtitle="docSubtitle"
              :contract-no="previewValues['contract.number']"
            />
          </div>
          <p class="text-xs text-muted">
            Tampilan mengikuti dokumen PDF aktual (Times New Roman, kop surat, tanda tangan dua pilar).
          </p>

          <div class="flex justify-between border-t border-default pt-3">
            <b>Fields</b>
            <UButton
              size="xs"
              label="Custom"
              icon="i-lucide-plus"
              @click="fieldOpen=true"
            />
          </div>
          <div v-for="f in fieldItems" :key="f.key" class="rounded border border-default p-2">
            <p class="text-sm">
              {{ f.label }}
            </p>
            <code class="text-xs text-muted">{{ placeholderText(f.key) }}</code>
            <UButton
              v-if="draft"
              class="mt-1 w-full"
              size="xs"
              variant="ghost"
              label="Sisipkan"
              @click="useField(f.key)"
            />
          </div>
        </aside>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-between">
        <UButton
          label="Tutup"
          color="neutral"
          variant="subtle"
          @click="open=false"
        />
        <UButton
          v-if="draft"
          label="Simpan draft"
          color="primary"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </UModal>

  <!-- Modal preview dokumen (validasi backend + tampilan dokumen) -->
  <UModal v-model:open="previewOpen" title="Preview dokumen" :ui="{ content: 'max-w-5xl w-full' }">
    <template #body>
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div class="max-h-[70vh] overflow-auto rounded-lg bg-neutral-200 p-3">
          <KontrakDocumentPreview
            :blocks="previewBlocks"
            :values="previewValues"
            :title="docTitle"
            :subtitle="docSubtitle"
            :contract-no="previewValues['contract.number']"
          />
        </div>
        <aside class="space-y-3">
          <div class="rounded-lg border border-default p-3">
            <p class="font-semibold">
              Validasi template
            </p>
            <div v-if="preview" class="mt-2 space-y-1 text-sm">
              <p>
                <span class="text-muted">Status:</span>
                <UBadge :color="preview.valid?'success':'error'" :label="preview.valid?'Valid':'Tidak valid'" />
              </p>
              <p><span class="text-muted">Placeholder:</span> {{ preview.placeholderCount }}</p>
              <p><span class="text-muted">Block:</span> {{ preview.blockCount }}</p>
            </div>
            <p v-else class="mt-2 text-xs text-muted">
              Klik Preview untuk menjalankan validasi backend.
            </p>
          </div>
          <p class="text-xs text-muted">
            Layout mengikuti dokumen PDF aktual. Nilai berwarna adalah data contoh.
          </p>
        </aside>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="fieldOpen" title="Custom field">
    <template #body>
      <div class="space-y-3">
        <UInput v-model="form.key" placeholder="key_field" />
        <UInput v-model="form.label" placeholder="Label" />
        <USelect v-model="form.dataType" :items="['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MASTER_REFERENCE']" />
        <USelect v-model="form.sourceType" :items="['CONTRACT_INPUT', 'MASTER_REFERENCE']" />
        <UInput v-if="form.dataType==='DROPDOWN'" v-model="form.options" placeholder="Opsi dipisah koma" />
      </div>
    </template>
    <template #footer>
      <UButton
        label="Buat"
        color="primary"
        :loading="fieldSaving"
        @click="createField"
      />
    </template>
  </UModal>
</template>
