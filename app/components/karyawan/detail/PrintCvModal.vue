<script setup lang="ts">
import type { Employee } from '~/types'

const props = defineProps<{
  open: boolean
  employee: Employee
  employeeDocs?: any[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const localOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

function printNow() {
  window.print()
}
</script>

<template>
  <UModal v-model:open="localOpen" :ui="{ content: 'max-w-5xl w-full p-0' }">
    <template #body>
      <div class="cv-preview">
        <KaryawanDetailCvDocument :employee="employee" :employee-docs="employeeDocs" />
      </div>
    </template>

    <template #footer>
      <div class="no-print flex justify-end gap-2 w-full">
        <UButton label="Tutup" color="neutral" variant="ghost" @click="localOpen = false" />
        <UButton label="Cetak / Simpan PDF" icon="i-lucide-printer" color="primary" @click="printNow" />
      </div>
    </template>
  </UModal>

  <!-- Teleport ke body tanpa ancestor fixed/overflow agar print multi-halaman berjalan -->
  <Teleport to="body">
    <div class="print-only-cv">
      <KaryawanDetailCvDocument :employee="employee" :employee-docs="employeeDocs" />
    </div>
  </Teleport>
</template>