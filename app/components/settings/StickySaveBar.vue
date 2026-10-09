<script setup lang="ts">
withDefaults(defineProps<{
  dirty?: boolean
  saving?: boolean
  message?: string
  saveLabel?: string
  resetLabel?: string
}>(), {
  dirty: false,
  saving: false,
  message: 'Ada perubahan yang belum disimpan.',
  saveLabel: 'Simpan Perubahan',
  resetLabel: 'Batalkan'
})

const emit = defineEmits<{ save: [], reset: [] }>()
</script>

<template>
  <div v-if="dirty" class="save-bar-enter sticky bottom-4 z-20 mt-6">
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-elevated/95 px-4 py-3 shadow-lg backdrop-blur">
      <p class="flex items-center gap-2 text-sm text-highlighted">
        <UIcon name="i-lucide-info" class="size-4 text-primary" />
        {{ message }}
      </p>
      <div class="flex items-center gap-2">
        <UButton
          :label="resetLabel"
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="emit('reset')"
        />
        <UButton
          :label="saveLabel"
          color="primary"
          icon="i-lucide-save"
          :loading="saving"
          @click="emit('save')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-bar-enter {
  animation: save-bar-enter 200ms ease-out;
}

@keyframes save-bar-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-bar-enter {
    animation: none;
  }
}
</style>
