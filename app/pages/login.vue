<script setup lang="ts">
definePageMeta({ layout: false })

const auth = useAuthStore()
const toast = useToast()

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
</script>

<template>
  <div class="min-h-dvh bg-default text-highlighted">
    <header class="border-b border-default bg-default/90 backdrop-blur">
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-md bg-primary text-xs font-bold text-white shadow-sm">
            K
          </div>
          <div class="leading-tight">
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
              Kokarsi PT. Sankyu
            </p>
            <h1 class="mt-1 text-base font-semibold text-highlighted">
              Portal Internal
            </h1>
          </div>
        </div>

        <UBadge color="neutral" variant="subtle">
          Master Admin
        </UBadge>
      </div>
    </header>

    <main class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.05),transparent_24%)]" />

      <div class="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div class="mx-auto max-w-5xl rounded-[28px] border border-default bg-default/92 shadow-sm ring-1 ring-default/60 backdrop-blur">
          <div class="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <section class="border-b border-default p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-9">
              <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
                <span class="size-2 rounded-full bg-primary" />
                Sistem Manajemen Karyawan
              </div>

              <h2 class="mt-5 max-w-md text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">
                Login yang lebih ringkas, tetap modern, dan konsisten.
              </h2>
              <p class="mt-3 max-w-md text-sm leading-7 text-muted">
                Admin bisa langsung masuk ke sistem tanpa distraksi visual berlebihan, tetap memakai pola kartu dan aksen yang sama dengan halaman utama.
              </p>

              <div class="mt-6 space-y-3">
                <div class="flex items-start gap-3 rounded-2xl bg-elevated/40 p-4 ring-1 ring-default/50">
                  <div class="rounded-xl bg-primary/10 p-2 ring-1 ring-inset ring-primary/20">
                    <UIcon name="i-lucide-shield-check" class="size-4 text-primary" />
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-highlighted">Master Admin</p>
                    <p class="mt-1 text-xs leading-6 text-muted">Akses untuk pengelolaan data karyawan, kontrak, dan master data.</p>
                  </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                  <div class="rounded-2xl bg-elevated/30 p-4 ring-1 ring-default/50">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Modul</p>
                    <p class="mt-2 text-sm font-semibold text-highlighted">Data Karyawan</p>
                  </div>
                  <div class="rounded-2xl bg-elevated/30 p-4 ring-1 ring-default/50">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Modul</p>
                    <p class="mt-2 text-sm font-semibold text-highlighted">Manajemen Kontrak</p>
                  </div>
                </div>
              </div>
            </section>

            <section class="p-6 sm:p-8 lg:p-9">
              <UCard class="w-full border-default bg-default/95 shadow-none ring-1 ring-default/50" :ui="{ header: 'p-6', body: 'p-6 pt-0' }">
              <template #header>
                <div class="space-y-4">
                  <div class="flex items-center gap-3">
                    <div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                      <UIcon name="i-lucide-log-in" class="size-5 text-primary" />
                    </div>
                    <div>
                      <p class="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                        Login
                      </p>
                      <h3 class="text-xl font-semibold text-highlighted">
                        Masuk ke Dashboard
                      </h3>
                    </div>
                  </div>
                  <p class="text-sm leading-6 text-muted">
                    Gunakan akun internal untuk melanjutkan ke pengelolaan data karyawan dan kontrak.
                  </p>
                </div>
              </template>

              <form class="space-y-5" @submit.prevent="handleLogin">
                <div class="space-y-2">
                  <label for="employeeNo" class="text-sm font-medium text-highlighted">
                    No. Induk / NIK / Username
                  </label>
                  <div class="group flex items-center rounded-xl border border-default bg-elevated/40 px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary/20">
                    <UIcon name="i-lucide-id-card" class="size-4 text-muted" />
                    <input
                      id="employeeNo"
                      v-model="form.employeeNo"
                      type="text"
                      autocomplete="username"
                      placeholder="Contoh: EMP001 atau pengelola1"
                      class="ml-3 w-full border-0 bg-transparent p-0 text-sm text-highlighted placeholder:text-dimmed focus:outline-none focus:ring-0"
                    >
                  </div>
                </div>

                <div class="space-y-2">
                  <label for="password" class="text-sm font-medium text-highlighted">
                    Password
                  </label>
                  <div class="group flex items-center rounded-xl border border-default bg-elevated/40 px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary/20">
                    <UIcon name="i-lucide-lock" class="size-4 text-muted" />
                    <input
                      id="password"
                      v-model="form.password"
                      :type="showPassword ? 'text' : 'password'"
                      autocomplete="current-password"
                      placeholder="Masukkan password"
                      class="ml-3 w-full border-0 bg-transparent p-0 text-sm text-highlighted placeholder:text-dimmed focus:outline-none focus:ring-0"
                    >
                    <button
                      type="button"
                      class="ml-3 rounded-md p-1 text-muted transition hover:bg-elevated hover:text-highlighted"
                      :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                      @click="showPassword = !showPassword"
                    >
                      <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" />
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3 rounded-xl bg-elevated/40 px-4 py-3 text-xs text-muted">
                  <span>Akses aman untuk administrator internal</span>
                  <span class="hidden sm:inline">Single role access</span>
                </div>

                <UButton
                  type="submit"
                  block
                  size="lg"
                  :loading="loading"
                  color="primary"
                >
                  Masuk
                </UButton>
              </form>
            </UCard>
            </section>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
