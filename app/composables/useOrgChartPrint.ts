import type { OrgNode, OrgChartDisplay } from '~/types/org-structure'

const MM_TO_PX = 96 / 25.4
const PAGE_MARGIN_MM = 10

interface PrintOptions {
  title: string
  display: OrgChartDisplay
}

const STATUS_STYLE: Record<string, { label: string, bg: string, fg: string, bd: string }> = {
  AKTIF: { label: 'Aktif', bg: '#dcfce7', fg: '#166534', bd: '#86efac' },
  AKAN_BERAKHIR: { label: 'Akan Berakhir', bg: '#fef3c7', fg: '#92400e', bd: '#fcd34d' },
  EXPIRED: { label: 'Expired', bg: '#fee2e2', fg: '#991b1b', bd: '#fca5a5' },
  TIDAK_AKTIF: { label: 'Tidak Aktif', bg: '#e2e8f0', fg: '#475569', bd: '#cbd5e1' },
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

function countNodes(nodes: OrgNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children ?? []), 0)
}

function buildNode(n: OrgNode, display: OrgChartDisplay): string {
  const photo = n.photoUrl || n.employee?.fotoKaryawan || ''
  const showPhoto = display.photo

  let avatar = ''
  if (showPhoto) {
    avatar = photo
      ? `<div class="avatar-wrap"><span class="avatar-init">${escapeHtml(initials(n.name))}</span><img class="avatar" src="${escapeHtml(photo)}" alt="" onerror="this.remove()"></div>`
      : `<div class="avatar-wrap"><span class="avatar-init">${escapeHtml(initials(n.name))}</span></div>`
  }

  const pos = display.position ? `<div class="pos">${escapeHtml(n.position)}</div>` : ''

  const badges: string[] = []
  if (display.unitUsaha && n.unitUsaha) {
    badges.push(`<span class="badge badge-unit">${escapeHtml(n.unitUsaha)}</span>`)
  }
  if (display.status) {
    const st = STATUS_STYLE[n.status] ?? { label: n.status, bg: '#e2e8f0', fg: '#475569', bd: '#cbd5e1' }
    badges.push(`<span class="badge" style="background:${st.bg};color:${st.fg};border-color:${st.bd}">${escapeHtml(st.label)}</span>`)
  }
  const badgeRow = badges.length ? `<div class="badges">${badges.join('')}</div>` : ''

  const children = n.children?.length
    ? `<div class="children"><ul class="tree">${n.children.map(c => buildBranch(c, display)).join('')}</ul></div>`
    : ''

  return `<div class="node">${avatar}<div class="nm">${escapeHtml(n.name)}</div>${pos}${badgeRow}</div>${children}`
}

function buildBranch(n: OrgNode, display: OrgChartDisplay): string {
  return `<li class="branch">${buildNode(n, display)}</li>`
}

function buildTree(nodes: OrgNode[], display: OrgChartDisplay): string {
  return `<ul class="tree root">${nodes.map(n => buildBranch(n, display)).join('')}</ul>`
}

const PRINT_STYLE = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
  /* width: max-content penting agar konten diukur pada ukuran intrinsiknya,
     tidak terpengaruh lebar viewport iframe (yang disembunyikan). */
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; width: max-content; min-width: 100%; }
  .hdr { text-align: center; margin-bottom: 14px; }
  .hdr h1 { font-size: 18px; margin: 0 0 2px; letter-spacing: -0.01em; }
  .hdr .sub { font-size: 12px; color: #64748b; }
  #stage { margin: 0 auto; width: max-content; }
  #chart { transform-origin: top left; width: max-content; }
  .tree { display: flex; justify-content: center; align-items: flex-start; list-style: none; margin: 0; padding: 0; }
  .branch { position: relative; display: flex; flex-direction: column; align-items: center; padding: 26px 10px 0; }
  .branch::before, .branch::after { content: ''; position: absolute; top: 0; right: 50%; width: 50%; height: 26px; border-top: 2px solid #94a3b8; }
  .branch::after { right: auto; left: 50%; border-left: 2px solid #94a3b8; }
  .branch:only-child::before, .branch:only-child::after { display: none; }
  .branch:only-child { padding-top: 26px; }
  .branch:first-child::before, .branch:last-child::after { border: 0 none; }
  .branch:last-child::before { border-right: 2px solid #94a3b8; border-radius: 0 10px 0 0; }
  .branch:first-child::after { border-radius: 10px 0 0 0; }
  .tree.root > .branch { padding-top: 0; }
  .tree.root > .branch::before, .tree.root > .branch::after { display: none; }
  .children { position: relative; }
  .children::before { content: ''; position: absolute; top: 0; left: 50%; width: 2px; height: 26px; background: #94a3b8; transform: translateX(-1px); }
  .node { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 140px; max-width: 200px; padding: 10px 12px; border: 1.5px solid #cbd5e1; border-radius: 12px; background: #fff; text-align: center; }
  .avatar-wrap { position: relative; width: 40px; height: 40px; }
  .avatar, .avatar-init { position: absolute; inset: 0; width: 40px; height: 40px; border-radius: 9999px; object-fit: cover; }
  .avatar-init { display: flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-size: 13px; font-weight: 600; }
  .nm { font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.25; }
  .pos { font-size: 11px; color: #475569; line-height: 1.25; }
  .badges { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 1px; }
  .badge { font-size: 9.5px; line-height: 1.5; padding: 0 6px; border-radius: 9999px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #475569; white-space: nowrap; }
`

/**
 * Cetak bagan struktur organisasi ke A4 (auto-fit 1 halaman) via iframe tersembunyi
 * sehingga tidak diblokir popup blocker. Seluruh cabang selalu terbuka, dan
 * metadata kartu mengikuti preferensi tampilan (chartDisplay) yang aktif.
 */
export function useOrgChartPrint() {
  function print(nodes: OrgNode[], opts: PrintOptions) {
    if (!import.meta.client) return
    if (!nodes.length) return

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '1200px',
      height: '900px',
      border: '0',
      visibility: 'hidden',
    })
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    if (!doc || !win) {
      iframe.remove()
      return
    }

    const printedAt = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const total = countNodes(nodes)
    const header = `<header class="hdr"><h1>Struktur Organisasi</h1><div class="sub">${escapeHtml(opts.title)} · ${total} jabatan · Dicetak ${escapeHtml(printedAt)}</div></header>`

    doc.open()
    doc.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>${escapeHtml(opts.title)}</title>
      <style id="print-style">${PRINT_STYLE}</style>
      <style id="page-style">@page { size: A4 portrait; margin: ${PAGE_MARGIN_MM}mm; }</style>
      </head><body>${header}<div id="stage"><div id="chart">${buildTree(nodes, opts.display)}</div></div></body></html>`)
    doc.close()

    const cleanup = () => setTimeout(() => iframe.remove(), 200)

    const run = () => {
      const stage = doc.getElementById('stage')
      const chart = doc.getElementById('chart')
      const hdr = doc.querySelector('.hdr') as HTMLElement | null
      const pageStyle = doc.getElementById('page-style')
      if (!stage || !chart || !pageStyle) {
        cleanup()
        return
      }

      const contentW = Math.ceil(chart.getBoundingClientRect().width)
      const contentH = Math.ceil(chart.getBoundingClientRect().height)
      const headerH = hdr ? Math.ceil(hdr.getBoundingClientRect().height) + 14 : 0

      // Area cetak A4 (mm) dikurangi margin.
      const PORTRAIT = { w: 210 - PAGE_MARGIN_MM * 2, h: 297 - PAGE_MARGIN_MM * 2 }
      const LANDSCAPE = { w: 297 - PAGE_MARGIN_MM * 2, h: 210 - PAGE_MARGIN_MM * 2 }
      const aspect = contentW / Math.max(1, contentH)
      const orientation = aspect > PORTRAIT.w / PORTRAIT.h ? 'landscape' : 'portrait'
      const area = orientation === 'landscape' ? LANDSCAPE : PORTRAIT
      const availW = area.w * MM_TO_PX
      const availH = area.h * MM_TO_PX - headerH

      const scale = Math.min(availW / contentW, availH / contentH, 1)

      pageStyle.textContent = `@page { size: A4 ${orientation}; margin: ${PAGE_MARGIN_MM}mm; }`
      stage.style.width = `${Math.ceil(contentW * scale)}px`
      stage.style.height = `${Math.ceil(contentH * scale)}px`
      chart.style.transform = `scale(${scale})`

      const go = () => {
        try {
          win.focus()
          win.print()
        } finally {
          cleanup()
        }
      }
      // Beri waktu browser menerapkan layout/transform sebelum dialog cetak.
      setTimeout(go, 250)
    }

    // Tunggu semua gambar termuat (maks 1.5s) agar pengukuran & cetak akurat.
    const waitImages = () => {
      const imgs = Array.from(doc.images)
      const pending = imgs.filter(img => !img.complete)
      if (!pending.length) {
        run()
        return
      }
      let done = false
      const finish = () => {
        if (done) return
        done = true
        run()
      }
      Promise.all(pending.map(img => new Promise<void>(res => {
        img.addEventListener('load', () => res(), { once: true })
        img.addEventListener('error', () => res(), { once: true })
      }))).then(finish)
      setTimeout(finish, 1500)
    }

    if (doc.readyState === 'complete') {
      waitImages()
    } else {
      iframe.addEventListener('load', waitImages, { once: true })
      setTimeout(waitImages, 400)
    }
  }

  return { print }
}
