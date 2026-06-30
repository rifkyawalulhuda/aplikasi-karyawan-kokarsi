export const useDashboard = createSharedComposable(() => {
  const isNotificationsSlideoverOpen = ref(false)

  return {
    isNotificationsSlideoverOpen
  }
})
