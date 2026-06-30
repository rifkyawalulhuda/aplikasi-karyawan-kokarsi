export function useConfirmDeleteToast() {
  const toast = useToast()

  function confirmDeleteToast(options: {
    title: string
    description: string
    confirmLabel?: string
    onConfirm: () => Promise<void> | void
  }) {
    const toastEntry = toast.add({
      title: options.title,
      description: options.description,
      icon: 'i-lucide-triangle-alert',
      color: 'error',
      duration: 0,
      close: false,
      actions: [
        {
          label: 'Batal',
          color: 'neutral',
          variant: 'ghost',
          onClick: () => toast.remove(toastEntry.id),
        },
        {
          label: options.confirmLabel ?? 'Hapus',
          color: 'error',
          variant: 'solid',
          onClick: async () => {
            toast.remove(toastEntry.id)
            await options.onConfirm()
          },
        },
      ],
    })

    return toastEntry.id
  }

  return {
    confirmDeleteToast,
  }
}
