import { ForbiddenException } from '@nestjs/common'

// Service meng-import PrismaService; URL dummy cukup karena test menyuntikkan
// service tiruan.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ContractTemplateVersionsController } = require('./contract-template-versions.controller')

/**
 * Jejak audit versi template harus memakai nama asli pelaku.
 *
 * Regresi yang dijaga: controller dulu membaca `req.user.username`, padahal JWT
 * hanya membawa `fullName`/`employeeNo`. Akibatnya setiap versi tercatat
 * "unknown" dan kartu template menampilkan "Diterbitkan ... oleh unknown".
 */
function makeController() {
  const calls: Array<{ method: string, args: unknown[] }> = []
  const record = (method: string) => async (...args: unknown[]) => {
    calls.push({ method, args })
    return { ok: true }
  }
  const service = {
    createDraft: record('createDraft'),
    updateDraft: record('updateDraft'),
    publish: record('publish'),
    rollback: record('rollback'),
    deleteVersion: record('deleteVersion'),
  }
  return { controller: new ContractTemplateVersionsController(service as never), calls }
}

/** Bentuk `req.user` hasil `AuthService.validateSession` (tanpa `username`). */
const adminReq = {
  user: {
    sub: 2,
    employeeNo: 'EMP001',
    fullName: 'Admin Kokarsi',
    role: 'ADMIN',
    kind: 'master_admin',
    email: '',
  },
}

describe('ContractTemplateVersionsController — nama pelaku', () => {
  it('publish mencatat fullName, bukan "unknown"', async () => {
    const { controller, calls } = makeController()
    await controller.publish(adminReq, 114)
    expect(calls).toEqual([{ method: 'publish', args: [114, { name: 'Admin Kokarsi' }] }])
  })

  it('createDraft / updateDraft / rollback / deleteVersion juga memakai fullName', async () => {
    const { controller, calls } = makeController()
    await controller.createDraft(adminReq, 1, {})
    await controller.updateDraft(adminReq, 2, {})
    await controller.rollback(adminReq, 3)
    await controller.removeVersion(adminReq, 4)

    expect(calls.map(c => c.args[c.args.length - 1])).toEqual([
      { name: 'Admin Kokarsi' },
      { name: 'Admin Kokarsi' },
      { name: 'Admin Kokarsi' },
      { name: 'Admin Kokarsi' },
    ])
  })

  it('akun user memakai `name` (fullName hasil validateSession)', async () => {
    const { controller, calls } = makeController()
    const userReq = { user: { sub: 26, employeeNo: 'pengelola1', fullName: 'Rina Permata', role: 'ADMIN', kind: 'user_account' } }
    await controller.publish(userReq, 5)
    expect(calls[0].args).toEqual([5, { name: 'Rina Permata' }])
  })

  it('jatuh ke employeeNo lalu "System" bila nama kosong', async () => {
    const { controller, calls } = makeController()
    await controller.publish({ user: { employeeNo: 'EMP009', role: 'ADMIN' } }, 6)
    await controller.publish({ user: { role: 'ADMIN' } }, 7)
    expect(calls.map(c => c.args[c.args.length - 1])).toEqual([
      { name: 'EMP009' },
      { name: 'System' },
    ])
  })

  it('tetap menolak non-admin', () => {
    const { controller } = makeController()
    expect(() => controller.publish({ user: { fullName: 'Staff', role: 'PENGELOLA_KOPERASI' } }, 8))
      .toThrow(ForbiddenException)
  })
})
