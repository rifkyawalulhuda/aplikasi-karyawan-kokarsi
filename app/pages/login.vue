<script setup lang="ts">
import type { LoginFeatureItem } from '~/types'

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
  loginTagline,
  loginSubtitle,
  loginFeatures,
  loginGreetingEnabled,
  loginRememberMeEnabled,
  loginOrnamentsEnabled,
  loginFooterShowVersion,
  loginSupportTitle,
  loginSupportContact,
  refresh: refreshSettings
} = useAppSettings()

// Fetch fresh settings on every login page load (before render)
await refreshSettings()

const appVersion = useRuntimeConfig().public.appVersion

const form = reactive({
  employeeNo: '',
  password: ''
})

const loading = ref(false)
const showPassword = ref(false)
const remember = ref(true)
const errorMessage = ref('')
const capsLock = ref(false)
const helpOpen = ref(false)

// Greeting dihitung di klien agar tidak ada hydration mismatch.
const greeting = ref('Selamat Datang')
onMounted(() => {
  if (!loginGreetingEnabled.value) return
  const h = new Date().getHours()
  greeting.value = h < 11
    ? 'Selamat Pagi'
    : h < 15
      ? 'Selamat Siang'
      : h < 19
        ? 'Selamat Sore'
        : 'Selamat Malam'
})

async function handleLogin() {
  errorMessage.value = ''
  if (!form.employeeNo || !form.password) {
    errorMessage.value = 'No. Induk dan password wajib diisi.'
    return
  }

  loading.value = true
  try {
    await auth.login(form.employeeNo, form.password, remember.value)
    await navigateTo('/')
  } catch (e: any) {
    const message = e?.data?.message ?? e?.data?.data?.message ?? e?.message ?? 'Kredensial tidak valid'
    errorMessage.value = message
    toast.add({
      title: 'Login Gagal',
      description: message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function onPasswordKey(e: KeyboardEvent) {
  if (typeof e.getModifierState === 'function') {
    capsLock.value = e.getModifierState('CapsLock')
  }
}

const orgFirstLetter = computed(() => (organizationName.value || 'K')[0])

const features = computed<LoginFeatureItem[]>(() => {
  if (loginFeatures.value.length) return loginFeatures.value
  return [
    { icon: 'i-lucide-users', text: 'Manajemen Data Karyawan' },
    { icon: 'i-lucide-file-text', text: 'Administrasi Kontrak Kerja' },
    { icon: 'i-lucide-bar-chart-3', text: 'Laporan & Ekspor Data' }
  ]
})

// Color mode toggle
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleColorMode() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

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
      <!-- Ornamen latar (opsional) -->
      <template v-if="loginOrnamentsEnabled">
        <div class="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-white/10 blur-3xl" />
        <div class="pointer-events-none absolute bottom-0 right-0 size-80 rounded-full bg-black/10 blur-3xl" />
      </template>

      <!-- Logo / Org header -->
      <div class="login-rise relative z-10 flex items-center gap-4">
        <div class="size-12 rounded-lg bg-white shadow flex items-center justify-center overflow-hidden shrink-0">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="organizationName"
            class="w-full h-full object-contain"
          >
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
      <div class="login-rise login-rise--delay relative z-10 max-w-md">
        <h1 class="text-5xl font-bold leading-tight tracking-tight text-white mb-6" :style="leftText">
          {{ loginTagline }}
        </h1>
        <p v-if="loginSubtitle" class="text-base leading-7 text-white/80 mb-12" :style="leftText">
          {{ loginSubtitle }}
        </p>

        <ul v-if="features.length" class="space-y-4">
          <li v-for="(feature, index) in features" :key="index" class="flex items-center gap-4 group">
            <div class="size-10 rounded-lg bg-white/10 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
              <UIcon :name="feature.icon || 'i-lucide-check'" class="size-5 text-white/90" />
            </div>
            <span class="text-base font-medium text-white" :style="leftText">{{ feature.text }}</span>
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
      <!-- Ornamen latar (opsional) -->
      <template v-if="loginOrnamentsEnabled">
        <div class="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-primary/5 blur-3xl" />
      </template>

      <!-- Theme toggle — top-right corner -->
      <div class="absolute top-4 right-4 z-20">
        <UButton
          :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'"
          @click="toggleColorMode"
        />
      </div>

      <!-- Mobile compact branding header (visible only on small screens) -->
      <div class="mb-10 flex items-center gap-3 self-start w-full md:hidden">
        <div class="size-10 rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="organizationName"
            class="w-full h-full object-contain"
          >
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

      <div class="login-rise relative z-10 w-full max-w-[480px]">
        <!-- Heading -->
        <div class="mb-8">
          <h2 class="text-3xl font-bold tracking-tight text-highlighted mb-2" :style="rightText">
            {{ greeting }}
          </h2>
          <p class="text-sm text-muted" :style="rightText">
            Masuk ke akun Anda untuk mengakses dashboard.
          </p>
        </div>

        <!-- Error inline -->
        <div
          v-if="errorMessage"
          class="mb-5"
          role="alert"
          aria-live="assertive"
        >
          <UAlert
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :description="errorMessage"
          />
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
              @update:model-value="errorMessage = ''"
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
              @keydown="onPasswordKey"
              @keyup="onPasswordKey"
              @blur="capsLock = false"
              @update:model-value="errorMessage = ''"
            >
              <template #leading>
                <UIcon name="i-lucide-lock" class="size-4 text-muted" />
              </template>
              <template #trailing>
                <button
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md text-muted transition hover:text-highlighted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                  @click="showPassword = !showPassword"
                >
                  <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" />
                </button>
              </template>
            </UInput>
            <p
              v-if="capsLock"
              class="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
              role="status"
              aria-live="polite"
            >
              <UIcon name="i-lucide-triangle-alert" class="size-3.5" />
              Caps Lock sedang aktif
            </p>
          </div>

          <!-- Remember me + help -->
          <div class="flex items-center justify-between gap-3">
            <UCheckbox
              v-if="loginRememberMeEnabled"
              v-model="remember"
              label="Ingat saya"
              :disabled="loading"
            />
            <span v-else />
            <button
              v-if="loginSupportTitle || loginSupportContact"
              type="button"
              class="text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              @click="helpOpen = true"
            >
              Butuh bantuan?
            </button>
          </div>

          <!-- Submit -->
          <div class="pt-1">
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

        <!-- Footer: version + support -->
        <div class="mt-8 flex flex-col items-center gap-1 text-xs text-muted opacity-80">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-shield-check" class="size-3.5" />
            <span>Akses aman untuk administrator internal</span>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="loginFooterShowVersion">Versi {{ appVersion }}</span>
            <template v-if="loginFooterShowVersion && loginSupportContact">
              <span aria-hidden="true">·</span>
            </template>
            <span v-if="loginSupportContact">{{ loginSupportContact }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Help modal -->
    <UModal v-model:open="helpOpen" :title="loginSupportTitle || 'Bantuan'">
      <template #body>
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Lupa password atau terkendala masuk? Hubungi administrator sistem untuk bantuan pemulihan akun.
          </p>
          <div v-if="loginSupportContact" class="flex items-start gap-3 rounded-lg border border-default bg-elevated/40 p-3">
            <UIcon name="i-lucide-headset" class="mt-0.5 size-4 shrink-0 text-primary" />
            <span class="text-highlighted">{{ loginSupportContact }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton
            label="Tutup"
            color="neutral"
            variant="outline"
            @click="helpOpen = false"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.login-rise {
  animation: login-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.login-rise--delay {
  animation-delay: 80ms;
}

@keyframes login-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-rise,
  .login-rise--delay {
    animation: none;
  }
}
</style>
