<script setup lang="ts">
definePageMeta({ layout: false })

const auth = useAuthStore()
const toast = useToast()
const { logoUrl, organizationName } = useAppSettings()

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
</script>

<template>
  <div class="min-h-dvh grid lg:grid-cols-2">
    <!-- Left: Corporate Branding -->
    <div class="relative hidden lg:flex flex-col justify-between bg-primary p-10 text-white overflow-hidden">
      <!-- Subtle pattern -->
      <div class="pointer-events-none absolute inset-0 opacity-[0.07]" style="background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><path d=%22M0 0h60v60H0z%22 fill=%22none%22/><path d=%22M0 0l60 60M60 0L0 60%22 stroke=%22white%22 stroke-width=%221%22/></svg>'); background-size: 60px 60px;" />

      <!-- Gradient overlay -->
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />

      <div class="relative z-10">
        <div class="flex items-center gap-3">
          <div class="flex size-11 items-center justify-center rounded-lg bg-white/15 backdrop-blur ring-1 ring-white/20 overflow-hidden">
            <img v-if="logoUrl" :src="logoUrl" :alt="organizationName" class="w-full h-full object-contain" />
            <span v-else class="text-lg font-bold tracking-tight">{{ orgFirstLetter }}</span>
          </div>
          <div class="leading-tight">
            <p class="text-[11px] font-medium uppercase tracking-[0.25em] text-white/70">
              Koperasi Karyawan
            </p>
            <p class="mt-0.5 text-sm font-semibold">
              {{ organizationName }}
            </p>
          </div>
        </div>
      </div>

      <div class="relative z-10 max-w-md">
        <h1 class="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          Sistem Manajemen Karyawan
        </h1>
        <p class="mt-4 text-sm leading-7 text-white/75">
          Platform internal untuk pengelolaan data karyawan, kontrak kerja, dan laporan operasional {{ organizationName }}.
        </p>

        <div class="mt-8 space-y-4">
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-lg bg-white/10">
              <UIcon name="i-lucide-users" class="size-4 text-white/80" />
            </div>
            <span class="text-sm text-white/80">Manajemen Data Karyawan</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-lg bg-white/10">
              <UIcon name="i-lucide-file-text" class="size-4 text-white/80" />
            </div>
            <span class="text-sm text-white/80">Administrasi Kontrak Kerja</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-lg bg-white/10">
              <UIcon name="i-lucide-bar-chart-3" class="size-4 text-white/80" />
            </div>
            <span class="text-sm text-white/80">Laporan & Ekspor Data</span>
          </div>
        </div>
      </div>

      <div class="relative z-10 text-xs text-white/50">
        &copy; {{ new Date().getFullYear() }} {{ organizationName }}. Hak cipta dilindungi.
      </div>
    </div>

    <!-- Right: Login Form -->
    <div class="flex flex-col items-center justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20">
      <div class="w-full max-w-sm">
        <!-- Mobile logo -->
        <div class="mb-10 flex items-center gap-3 lg:hidden">
          <div class="flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white overflow-hidden">
            <img v-if="logoUrl" :src="logoUrl" :alt="organizationName" class="w-full h-full object-contain" />
            <span v-else>{{ orgFirstLetter }}</span>
          </div>
          <div class="leading-tight">
            <p class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {{ organizationName }}
            </p>
            <p class="text-sm font-semibold text-highlighted">
              Portal Internal
            </p>
          </div>
        </div>

        <!-- Header -->
        <div class="mb-8">
          <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
            Selamat Datang
          </h2>
          <p class="mt-2 text-sm text-muted">
            Masuk ke akun Anda untuk mengakses dashboard.
          </p>
        </div>

        <!-- Form -->
        <form class="space-y-5" @submit.prevent="handleLogin">
          <div class="space-y-1.5">
            <label for="employeeNo" class="text-sm font-medium text-highlighted">
              No. Induk / NIK / Username
            </label>
            <UInput
              id="employeeNo"
              v-model="form.employeeNo"
              type="text"
              autocomplete="username"
              placeholder="EMP001 atau pengelola1"
              icon="i-lucide-user"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-lg' }"
            />
          </div>

          <div class="space-y-1.5">
            <label for="password" class="text-sm font-medium text-highlighted">
              Password
            </label>
            <UInput
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Masukkan password"
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-lock'"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-lg' }"
              @click:trailing="showPassword = !showPassword"
            >
              <template #trailing>
                <button
                  type="button"
                  class="rounded-md p-1 text-muted transition hover:text-highlighted"
                  :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                  @click="showPassword = !showPassword"
                >
                  <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" />
                </button>
              </template>
            </UInput>
          </div>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="loading"
            color="primary"
            class="rounded-lg"
            label="Masuk"
          />
        </form>

        <!-- Footer -->
        <div class="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-shield-check" class="size-3.5" />
          <span>Akses aman untuk administrator internal</span>
        </div>
      </div>
    </div>
  </div>
</template>
