<script setup lang="ts">
definePageMeta({ layout: false })

const auth = useAuthStore()
const toast = useToast()
const {
  logoUrl,
  organizationName,
  loginLeftBgColor,
  loginRightBgColor,
  loginLeftImageUrl,
  loginRightImageUrl,
  loginLeftOverlayOpacity,
  loginRightOverlayOpacity,
  loginLeftTextColor,
  loginRightTextColor,
  refresh: refreshSettings,
} = useAppSettings()

// Fetch fresh settings on every login page load (before render)
await refreshSettings()

const form = reactive({
  employeeNo: '',
  password: '',
})

const loading = ref(false)
const showPassword = ref(false)

async function handleLogin() {
  if (!form.employeeNo || !form.password) return

  loading.value = true
  try {
    await auth.login(form.employeeNo, form.password)
    await navigateTo('/')
  } catch (e: any) {
    toast.add({
      title: 'Login Gagal',
      description: e?.data?.message ?? e?.message ?? 'Kredensial tidak valid',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const orgFirstLetter = computed(() => (organizationName.value || 'K')[0])

const loginLeftPanelStyle = computed(() => {
  const style: Record<string, string> = {}
  if (loginLeftBgColor.value) style.backgroundColor = loginLeftBgColor.value
  if (loginLeftImageUrl.value) {
    style.backgroundImage = `url('${loginLeftImageUrl.value}')`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  return style
})

const loginRightPanelStyle = computed(() => {
  const style: Record<string, string> = {}
  if (loginRightBgColor.value) style.backgroundColor = loginRightBgColor.value
  if (loginRightImageUrl.value) {
    style.backgroundImage = `url('${loginRightImageUrl.value}')`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  return style
})

// Text color styles — applied directly to text elements to override Tailwind text-white
const leftText = computed(() => loginLeftTextColor.value ? { color: loginLeftTextColor.value } : {})
const rightText = computed(() => loginRightTextColor.value ? { color: loginRightTextColor.value } : {})
</script>

<template>
  <div class="min-h-dvh flex flex-col md:flex-row">

    <!-- Left Panel: Branding (hidden on mobile) -->
    <div
      class="relative hidden md:flex md:w-1/2 flex-col justify-between p-16 overflow-hidden"
      :class="{ 'bg-primary': !loginLeftBgColor }"
      :style="loginLeftPanelStyle"
    >

      <!-- Dark scrim overlay — opacity controlled by settings (0=none, 100=full black) -->
      <div
        class="pointer-events-none absolute inset-0"
        :style="{ backgroundColor: `rgba(0,0,0,${loginLeftOverlayOpacity / 100})` }"
      />
      <!-- Subtle grid pattern (fixed low opacity decorative) -->
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.06]"
        style="background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><path d=%22M0 0h60v60H0z%22 fill=%22none%22/><path d=%22M0 0l60 60M60 0L0 60%22 stroke=%22white%22 stroke-width=%221%22/></svg>'); background-size: 60px 60px;"
      />

      <!-- Logo / Org header -->
      <div class="relative z-10 flex items-center gap-4">
        <div class="size-12 rounded-lg bg-white shadow flex items-center justify-center overflow-hidden shrink-0">
          <img v-if="logoUrl" :src="logoUrl" :alt="organizationName" class="w-full h-full object-contain" />
          <UIcon v-else name="i-lucide-users" class="size-6 text-primary" />
        </div>
        <div class="leading-tight">
          <p class="text-[11px] font-medium uppercase tracking-[0.25em] text-white/70" :style="leftText">
            Koperasi Karyawan
          </p>
          <p class="text-sm font-bold text-white" :style="leftText">
            {{ organizationName }}
          </p>
        </div>
      </div>

      <!-- Main value proposition -->
      <div class="relative z-10 max-w-md">
        <h1 class="text-5xl font-bold leading-tight tracking-tight text-white mb-6" :style="leftText">
          Sistem Manajemen Karyawan
        </h1>
        <p class="text-base leading-7 text-white/80 mb-12" :style="leftText">
          Platform internal untuk pengelolaan data karyawan, kontrak kerja, dan laporan operasional {{ organizationName }}.
        </p>

        <ul class="space-y-4">
          <li class="flex items-center gap-4 group">
            <div class="size-10 rounded-lg bg-white/10 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
              <UIcon name="i-lucide-users" class="size-5 text-white/90" />
            </div>
            <span class="text-base font-medium text-white" :style="leftText">Manajemen Data Karyawan</span>
          </li>
          <li class="flex items-center gap-4 group">
            <div class="size-10 rounded-lg bg-white/10 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
              <UIcon name="i-lucide-file-text" class="size-5 text-white/90" />
            </div>
            <span class="text-base font-medium text-white" :style="leftText">Administrasi Kontrak Kerja</span>
          </li>
          <li class="flex items-center gap-4 group">
            <div class="size-10 rounded-lg bg-white/10 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
              <UIcon name="i-lucide-bar-chart-3" class="size-5 text-white/90" />
            </div>
            <span class="text-base font-medium text-white" :style="leftText">Laporan &amp; Ekspor Data</span>
          </li>
        </ul>
      </div>

      <!-- Copyright -->
      <div class="relative z-10 text-xs text-white/50" :style="leftText">
        &copy; {{ new Date().getFullYear() }} {{ organizationName }}. Hak cipta dilindungi.
      </div>
    </div>

    <!-- Right Panel: Login Form -->
    <div
      class="relative flex-1 md:w-1/2 flex flex-col items-center justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-hidden"
      :class="{ 'bg-background': !loginRightBgColor }"
      :style="loginRightPanelStyle"
    >
      <!-- Right dark scrim overlay — always present, opacity controlled by settings -->
      <div
        class="pointer-events-none absolute inset-0"
        :style="{ backgroundColor: `rgba(0,0,0,${loginRightOverlayOpacity / 100})` }"
      />

      <!-- Mobile logo (visible only on small screens) -->
      <div class="mb-10 flex items-center gap-3 self-start w-full md:hidden">
        <div class="size-10 rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0">
          <img v-if="logoUrl" :src="logoUrl" :alt="organizationName" class="w-full h-full object-contain" />
          <span v-else class="text-sm font-bold text-white">{{ orgFirstLetter }}</span>
        </div>
        <div class="leading-tight">
          <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            Koperasi Karyawan
          </p>
          <p class="text-sm font-semibold text-highlighted">
            {{ organizationName }}
          </p>
        </div>
      </div>

      <div class="w-full max-w-[480px]">
        <!-- Heading -->
        <div class="mb-8">
          <h2 class="text-3xl font-bold tracking-tight text-highlighted mb-2" :style="rightText">
            Selamat Datang
          </h2>
          <p class="text-sm text-muted" :style="rightText">
            Masuk ke akun Anda untuk mengakses dashboard.
          </p>
        </div>

        <!-- Form -->
        <form class="space-y-5" @submit.prevent="handleLogin">

          <!-- Employee No / Username -->
          <div class="space-y-1.5">
            <label for="employeeNo" class="block text-sm font-semibold text-highlighted">
              No. Induk / NIK / Username
            </label>
            <UInput
              id="employeeNo"
              v-model="form.employeeNo"
              type="text"
              placeholder="Masukkan ID Anda"
              required
              autocomplete="username"
              :disabled="loading"
              class="w-full"
              size="lg"
            >
              <template #leading>
                <UIcon name="i-lucide-user" class="size-4 text-muted" />
              </template>
            </UInput>
          </div>

          <!-- Password -->
          <div class="space-y-1.5">
            <label for="password" class="block text-sm font-semibold text-highlighted">
              Password
            </label>
            <UInput
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              required
              autocomplete="current-password"
              :disabled="loading"
              class="w-full"
              size="lg"
            >
              <template #leading>
                <UIcon name="i-lucide-lock" class="size-4 text-muted" />
              </template>
              <template #trailing>
                <button
                  type="button"
                  class="text-muted transition hover:text-highlighted focus:outline-none"
                  :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                  @click="showPassword = !showPassword"
                >
                  <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" />
                </button>
              </template>
            </UInput>
          </div>

          <!-- Submit -->
          <div class="pt-2">
            <UButton
              type="submit"
              block
              size="lg"
              :loading="loading"
              color="primary"
              class="rounded-lg font-semibold"
              label="Masuk"
            />
          </div>
        </form>

        <!-- Security footer -->
        <div class="mt-8 flex items-center justify-center gap-2 text-xs text-muted opacity-70">
          <UIcon name="i-lucide-shield-check" class="size-3.5" />
          <span>Akses aman untuk administrator internal</span>
        </div>
      </div>
    </div>
  </div>
</template>
