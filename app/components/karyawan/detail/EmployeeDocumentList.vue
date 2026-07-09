<script setup lang="ts">
interface EmployeeDocument {
  id: number
  employeeId: number
  documentTypeId: number
  documentNumber: string
  expiryDate: string
  notes?: string
  fileUrl?: string
  status: 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED'
  employee: { id: number; employeeNo: string; fullName: string }
  documentType: { id: number; name: string; documentType: string; issuer: string }
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  documents: EmployeeDocument[]
}>()

function formatDate(val: string | undefined) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_EXPIRED: 'Akan Expired',
  EXPIRED: 'Expired',
}

const statusColorMap: Record<string, string> = {
  AKTIF: 'success',
  AKAN_EXPIRED: 'warning',
  EXPIRED: 'error',
}

const statusDotColorMap: Record<string, string> = {
  AKTIF: 'bg-success',
  AKAN_EXPIRED: 'bg-warning',
  EXPIRED: 'bg-error',
}

const docTypeColorMap: Record<string, string> = {
  SERTIFIKAT: 'info',
  LISENSI: 'success',
  IZIN: 'warning',
  RAHASIA: 'error',
  LAINNYA: 'neutral',
}

// Sort: yang paling dekat expired di atas, lalu yang sudah expired
const sorted = computed(() =>
  [...props.documents].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base font-semibold text-highlighted">
        Sertifikasi & Ijin
        <span class="ml-1 text-sm font-normal text-muted">({{ documents.length }})</span>
      </h2>
      <NuxtLink
        to="/dokumen/sertifikasi-ijin"
        class="text-xs text-primary hover:underline flex items-center gap-1"
      >
        Lihat Semua
        <UIcon name="i-lucide-arrow-right" class="w-3 h-3" />
      </NuxtLink>
    </div>

    <div v-if="sorted.length === 0" class="text-sm text-muted py-4 text-center">
      Belum ada data sertifikasi & ijin.
    </div>

    <div v-else class="relative">
      <!-- Scrollable container -->
      <div class="max-h-[400px] lg:max-h-[600px] overflow-y-auto pr-2 relative">
        <!-- Timeline line -->
        <div class="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div class="space-y-4 pb-4">
          <div
            v-for="doc in sorted"
            :key="doc.id"
            class="relative pl-10"
          >
            <!-- Timeline dot -->
            <div
              class="absolute left-3 top-4 w-2.5 h-2.5 rounded-full border-2 border-background"
              :class="statusDotColorMap[doc.status] ?? 'bg-muted'"
            />

            <div class="p-4 rounded-lg bg-default border border-default">
              <!-- Header: nama dokumen + status badge -->
              <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ doc.documentType?.name ?? '-' }}
                  </p>
                  <p class="font-mono text-xs text-muted">{{ doc.documentNumber }}</p>
                </div>
                <UBadge
                  :color="(statusColorMap[doc.status] ?? 'neutral') as any"
                  variant="subtle"
                  size="sm"
                >
                  {{ statusLabelMap[doc.status] ?? doc.status }}
                </UBadge>
              </div>

              <!-- Jenis + Penerbit -->
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <UBadge
                  :color="(docTypeColorMap[doc.documentType?.documentType] ?? 'neutral') as any"
                  variant="subtle"
                  size="sm"
                >
                  {{ doc.documentType?.documentType ?? '-' }}
                </UBadge>
                <span class="text-xs text-muted">{{ doc.documentType?.issuer ?? '-' }}</span>
              </div>

              <!-- Masa berlaku -->
              <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted mb-2">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
                  Berlaku sampai: {{ formatDate(doc.expiryDate) }}
                </span>
              </div>

              <!-- Catatan -->
              <p v-if="doc.notes" class="text-xs text-muted mb-2 italic line-clamp-2">
                {{ doc.notes }}
              </p>

              <!-- Link file -->
              <a
                v-if="doc.fileUrl"
                :href="doc.fileUrl"
                target="_blank"
                class="flex items-center gap-1 text-primary hover:underline text-sm"
              >
                <UIcon name="i-lucide-paperclip" class="w-3.5 h-3.5" />
                Lihat File
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
