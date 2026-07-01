export function useConfirmActionToast() {
  const toast = useToast()

  function confirmActionToast(options: {
    title: string
    description: string
    icon?: string
    color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
    confirmLabel?: string
    confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
    onConfirm: () => Promise<void> | void
  }) {
    const toastEntry = toast.add({
      title: options.title,
      description: options.description,
      icon: options.icon ?? 'i-lucide-triangle-alert',
      color: options.color ?? 'warning',
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
          label: options.confirmLabel ?? 'Lanjut',
          color: options.confirmColor ?? 'primary',
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

  return { confirmActionToast }
}
