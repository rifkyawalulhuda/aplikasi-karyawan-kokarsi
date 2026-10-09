<script setup lang="ts">
const props = defineProps<{
  count: number
  loading?: boolean
}>()

const emit = defineEmits<{
  clear: []
  delete: []
  export: []
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-3 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
  >
    <div
      v-if="props.count > 0"
      class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <div class="pointer-events-auto flex items-center gap-2 rounded-full border border-default bg-default/95 px-3 py-2 shadow-lg backdrop-blur">
        <UBadge
          color="primary"
          variant="subtle"
          size="sm"
          class="tabular-nums"
        >
          {{ props.count }} dipilih
        </UBadge>
        <USeparator orientation="vertical" class="h-5" />
        <UButton
          label="Export"
          icon="i-lucide-download"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="emit('export')"
        />
        <UButton
          label="Hapus"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          size="sm"
          :loading="props.loading"
          @click="emit('delete')"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Batalkan pilihan"
          @click="emit('clear')"
        />
      </div>
    </div>
  </Transition>
</template>
