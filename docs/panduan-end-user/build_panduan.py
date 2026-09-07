
#!/usr/bin/env python3
"""
Build Panduan Pengguna Kokarsi - DOCX Generator
"""
import os
from docx import Document
from docx.shared import Mm, Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

ASSETS = r"E:/Github/aplikasi-karyawan-kokarsi/docs/panduan-end-user/assets"
OUTPUT = r"E:/Github/aplikasi-karyawan-kokarsi/docs/panduan-end-user/Panduan-Pengguna-Kokarsi.docx"

# ── helpers ──────────────────────────────────────────────────────────────
def set_page(doc):
    sec = doc.sections[0]
    sec.page_width  = Mm(210)
    sec.page_height = Mm(297)
    sec.top_margin    = Mm(25)
    sec.bottom_margin = Mm(20)
    sec.left_margin   = Mm(25)
    sec.right_margin  = Mm(20)

def add_header_footer(doc):
    # header
    sec = doc.sections[0]
    hdr = sec.header
    hdr.is_linked_to_previous = False
    hp = hdr.paragraphs[0]
    hp.text = "Panduan Pengguna Sistem Informasi Manajemen Karyawan KOKARSI"
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = hp.runs[0]
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    # separator line under header
    pPr = hp._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), 'CCCCCC')
    pBdr.append(bottom)
    pPr.append(pBdr)

    # footer with page numbers
    ftr = sec.footer
    ftr.is_linked_to_previous = False
    fp = ftr.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.add_run("Halaman ")
    fld_run = OxmlElement('w:fldChar')
    fld_run.set(qn('w:fldCharType'), 'begin')
    fp.runs[-1]._r.append(fld_run)
    instr = OxmlElement('w:instrText')
    instr.text = ' PAGE '
    r2 = OxmlElement('w:r')
    r2.append(instr)
    fp._p.append(r2)
    fld_end = OxmlElement('w:fldChar')
    fld_end.set(qn('w:fldCharType'), 'end')
    r3 = OxmlElement('w:r')
    r3.append(fld_end)
    fp._p.append(r3)
    fp.add_run(" | KOKARSI © 2025").font.size = Pt(9)
    for run in fp.runs:
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x77, 0x77, 0x77)

def h1(doc, text):
    p = doc.add_heading(text, level=1)
    p.runs[0].font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after  = Pt(6)
    return p

def h2(doc, text):
    p = doc.add_heading(text, level=2)
    p.runs[0].font.color.rgb = RGBColor(0x2E, 0x74, 0xB5)
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after  = Pt(4)
    return p

def h3(doc, text):
    p = doc.add_heading(text, level=3)
    p.runs[0].font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after  = Pt(3)
    return p

def para(doc, text, bold=False, italic=False, color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)
    run.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(6)
    return p

def bullet(doc, items):
    for item in items:
        p = doc.add_paragraph(style='List Bullet')
        run = p.add_run(item)
        run.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(3)

def numbered(doc, items):
    for item in items:
        p = doc.add_paragraph(style='List Number')
        run = p.add_run(item)
        run.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(3)

def img(doc, filename, caption=None, width_mm=155):
    path = os.path.join(ASSETS, filename)
    if not os.path.exists(path):
        para(doc, f"[Gambar tidak ditemukan: {filename}]", italic=True, color=(180,0,0))
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(path, width=Mm(width_mm))
    p.paragraph_format.space_after = Pt(2)
    if caption:
        cp = doc.add_paragraph(caption)
        cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cp.paragraph_format.space_before = Pt(0)
        cp.paragraph_format.space_after  = Pt(10)
        for r in cp.runs:
            r.font.size = Pt(9)
            r.font.italic = True
            r.font.color.rgb = RGBColor(0x55,0x55,0x55)

def divider(doc):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), 'BBBBBB')
    pBdr.append(bottom)
    pPr.append(pBdr)
    p.paragraph_format.space_after = Pt(6)

def info_box(doc, text, bg_hex="E8F4FD", border_hex="2E74B5"):
    """Simple shaded paragraph as info/tip box"""
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), bg_hex)
    pPr.append(shd)
    run = p.add_run("ℹ  " + text)
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(0x1F,0x4E,0x79)
    p.paragraph_format.left_indent  = Mm(5)
    p.paragraph_format.right_indent = Mm(5)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after  = Pt(6)
    return p

def warning_box(doc, text):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'FFF3CD')
    pPr.append(shd)
    run = p.add_run("⚠  " + text)
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(0x85,0x66,0x04)
    p.paragraph_format.left_indent  = Mm(5)
    p.paragraph_format.right_indent = Mm(5)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after  = Pt(6)
    return p

def status_table(doc, rows):
    """rows: list of (status_label, color_hex, description)"""
    tbl = doc.add_table(rows=1+len(rows), cols=2)
    tbl.style = 'Table Grid'
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    # header
    hdr_cells = tbl.rows[0].cells
    for i, txt in enumerate(["Status", "Keterangan"]):
        hdr_cells[i].text = txt
        hdr_cells[i].paragraphs[0].runs[0].bold = True
        hdr_cells[i].paragraphs[0].runs[0].font.size = Pt(10)
        tc = hdr_cells[i]._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), '1F4E79')
        tcPr.append(shd)
        hdr_cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF,0xFF,0xFF)
    for i, (label, color, desc) in enumerate(rows):
        row = tbl.rows[i+1].cells
        row[0].text = label
        row[0].paragraphs[0].runs[0].bold = True
        row[0].paragraphs[0].runs[0].font.size = Pt(10)
        tc = row[0]._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), color)
        tcPr.append(shd)
        row[1].text = desc
        row[1].paragraphs[0].runs[0].font.size = Pt(10)
    doc.add_paragraph()

def cover_page(doc):
    # Logo placeholder / title block
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Mm(30)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("PANDUAN PENGGUNA")
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run2 = p2.add_run("Sistem Informasi Manajemen Karyawan")
    run2.bold = True
    run2.font.size = Pt(20)
    run2.font.color.rgb = RGBColor(0x2E, 0x74, 0xB5)

    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run3 = p3.add_run("KOKARSI")
    run3.bold = True
    run3.font.size = Pt(32)
    run3.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    p3.paragraph_format.space_after = Pt(6)

    p4 = doc.add_paragraph()
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run4 = p4.add_run("Koperasi Karyawan Sankyu Indonesia")
    run4.font.size = Pt(14)
    run4.font.color.rgb = RGBColor(0x44, 0x72, 0xC4)
    p4.paragraph_format.space_after = Mm(20)

    divider(doc)

    p5 = doc.add_paragraph()
    p5.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run5 = p5.add_run("Panduan ini ditujukan bagi pengguna akhir (End User) non-teknis\nuntuk membantu penggunaan sistem secara mandiri dan efisien.")
    run5.font.size = Pt(11)
    run5.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    run5.font.italic = True
    p5.paragraph_format.space_after = Mm(25)

    tbl = doc.add_table(rows=3, cols=2)
    tbl.style = 'Table Grid'
    data = [
        ("Versi Dokumen", "1.0"),
        ("Tanggal", "September 2025"),
        ("Dipersiapkan oleh", "Tim Pengembang KOKARSI"),
    ]
    for i, (k, v) in enumerate(data):
        row = tbl.rows[i].cells
        row[0].text = k
        row[0].paragraphs[0].runs[0].bold = True
        row[0].paragraphs[0].runs[0].font.size = Pt(10)
        row[1].text = v
        row[1].paragraphs[0].runs[0].font.size = Pt(10)
    doc.add_page_break()


# ═══════════════════════════════════════════════════════════════════════════
# MAIN BUILD
# ═══════════════════════════════════════════════════════════════════════════
doc = Document()
set_page(doc)
add_header_footer(doc)
cover_page(doc)

# ── DAFTAR ISI (manual – Word updates on open) ────────────────────────────
h1(doc, "Daftar Isi")
toc_items = [
    ("1", "Pendahuluan", "3"),
    ("2", "Login & Akses Sistem", "4"),
    ("3", "Dashboard (Beranda)", "5"),
    ("4", "Modul Data Karyawan", "6"),
    ("5", "Modul Manajemen Kontrak", "9"),
    ("6", "Modul Dokumen Karyawan", "12"),
    ("7", "Modul Surat Peringatan (SP)", "14"),
    ("8", "Modul Sertifikasi & Izin", "17"),
    ("9", "Modul Dokumen Legal", "18"),
    ("10", "Modul Notifikasi", "20"),
    ("11", "Modul Pengaturan", "21"),
    ("12", "Pertanyaan Umum (FAQ)", "27"),
]
tbl = doc.add_table(rows=len(toc_items), cols=3)
tbl.style = 'Table Grid'
for i, (no, title, pg) in enumerate(toc_items):
    cells = tbl.rows[i].cells
    cells[0].text = no
    cells[1].text = title
    cells[2].text = pg
    for j in range(3):
        cells[j].paragraphs[0].runs[0].font.size = Pt(11)
        if j == 0:
            cells[j].paragraphs[0].runs[0].bold = True
doc.add_page_break()


# ── BAB 1: PENDAHULUAN ────────────────────────────────────────────────────
h1(doc, "1. Pendahuluan")
para(doc, "Panduan ini menjelaskan cara menggunakan Sistem Informasi Manajemen Karyawan KOKARSI (Koperasi Karyawan Sankyu Indonesia). Sistem ini dirancang untuk memudahkan pengelolaan data karyawan, kontrak kerja, dokumen, dan surat peringatan secara terpusat dan terkomputerisasi.")
para(doc, "Sebelum menggunakan sistem, pastikan Anda memiliki akun yang telah disiapkan oleh administrator.")

h2(doc, "1.1 Tujuan Panduan")
bullet(doc, [
    "Memandu pengguna non-teknis dalam mengoperasikan sistem KOKARSI dari awal hingga mahir",
    "Menjelaskan setiap modul dan fitur yang tersedia beserta langkah penggunaannya",
    "Menjadi referensi cepat saat menghadapi pertanyaan seputar penggunaan sistem",
])

h2(doc, "1.2 Hak Akses Pengguna")
para(doc, "Sistem KOKARSI memiliki dua level akses pengguna:")
tbl2 = doc.add_table(rows=3, cols=3)
tbl2.style = 'Table Grid'
headers = ["Role", "Akses", "Keterangan"]
for i, h in enumerate(headers):
    tbl2.rows[0].cells[i].text = h
    tbl2.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    tbl2.rows[0].cells[i].paragraphs[0].runs[0].font.size = Pt(10)
    tc = tbl2.rows[0].cells[i]._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '1F4E79')
    tcPr.append(shd)
    tbl2.rows[0].cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(255,255,255)

data2 = [
    ("Master Admin", "Penuh — semua modul termasuk Master Data & Manajemen User", "Administrator sistem utama"),
    ("Pengelola Koperasi", "Sebagian — semua modul kecuali Master Data dan Manajemen User", "Staf operasional koperasi"),
]
for i, (r, a, k) in enumerate(data2):
    tbl2.rows[i+1].cells[0].text = r
    tbl2.rows[i+1].cells[1].text = a
    tbl2.rows[i+1].cells[2].text = k
    for j in range(3):
        tbl2.rows[i+1].cells[j].paragraphs[0].runs[0].font.size = Pt(10)
doc.add_paragraph()
doc.add_page_break()


# ── BAB 2: LOGIN ──────────────────────────────────────────────────────────
h1(doc, "2. Login & Akses Sistem")
para(doc, "Untuk mengakses sistem KOKARSI, buka browser (Google Chrome, Firefox, atau Edge) dan ketikkan alamat berikut pada bilah alamat:")
p_url = doc.add_paragraph()
run_url = p_url.add_run("https://kokarsi-sankyu.web.id/login")
run_url.bold = True
run_url.font.size = Pt(12)
run_url.font.color.rgb = RGBColor(0x2E, 0x74, 0xB5)
p_url.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_url.paragraph_format.space_after = Pt(12)

img(doc, "01-login.png", "Gambar 2.1 — Halaman Login KOKARSI")

h2(doc, "2.1 Cara Login")
numbered(doc, [
    "Buka browser dan ketikkan alamat sistem di atas",
    "Masukkan Username Anda pada kolom yang tersedia (contoh: KOKARSI01)",
    "Masukkan Password Anda pada kolom kata sandi",
    'Klik tombol "Masuk" berwarna biru',
    "Jika berhasil, Anda akan diarahkan ke halaman Dashboard",
])
info_box(doc, "Username dan password diberikan oleh administrator. Hubungi admin jika belum memiliki akun atau lupa password.")

h2(doc, "2.2 Keluar dari Sistem (Logout)")
numbered(doc, [
    "Klik foto profil atau nama pengguna di pojok kanan atas layar",
    'Pilih menu "Keluar" atau "Logout"',
    "Sistem akan mengarahkan kembali ke halaman Login",
])
warning_box(doc, "Selalu lakukan logout setelah selesai menggunakan sistem, terutama jika menggunakan komputer bersama.")
doc.add_page_break()


# ── BAB 3: DASHBOARD ──────────────────────────────────────────────────────
h1(doc, "3. Dashboard (Beranda)")
para(doc, "Setelah berhasil login, Anda akan melihat Dashboard — halaman utama sistem yang menampilkan ringkasan kondisi karyawan dan kontrak secara sekilas.")
img(doc, "02-dashboard.png", "Gambar 3.1 — Halaman Dashboard KOKARSI")

h2(doc, "3.1 Informasi pada Dashboard")
bullet(doc, [
    "Total Karyawan Aktif — jumlah karyawan yang saat ini aktif bekerja",
    "Kontrak Aktif — jumlah kontrak yang sedang berjalan",
    "Kontrak Akan Habis — jumlah kontrak yang akan berakhir dalam 30 hari ke depan",
    "Kontrak Expired — jumlah kontrak yang sudah melewati tanggal berakhir",
    "Grafik statistik karyawan berdasarkan departemen dan tipe kontrak",
    "Daftar notifikasi terbaru (kontrak hampir habis, pengingat penting)",
])

h2(doc, "3.2 Navigasi Sistem")
para(doc, "Di sisi kiri layar terdapat menu navigasi utama yang dapat Anda gunakan untuk berpindah antar modul:")
bullet(doc, [
    "Data Karyawan — pengelolaan data lengkap karyawan",
    "Manajemen Kontrak — pengelolaan kontrak kerja",
    "Dokumen Karyawan — arsip dokumen pribadi karyawan",
    "Surat Peringatan — penerbitan dan arsip SP",
    "Sertifikasi & Izin — dokumen sertifikat dan izin karyawan",
    "Dokumen Legal — kontrak vendor, legal koperasi, akte",
    "Notifikasi — peringatan dan pengingat sistem",
    "Pengaturan — konfigurasi sistem (khusus Admin)",
])
doc.add_page_break()


# ── BAB 4: DATA KARYAWAN ──────────────────────────────────────────────────
h1(doc, "4. Modul Data Karyawan")
para(doc, "Modul ini adalah inti dari sistem KOKARSI. Di sini Anda dapat melihat, mencari, menambah, mengubah, dan menghapus data karyawan.")
img(doc, "03-data-karyawan.png", "Gambar 4.1 — Halaman Daftar Data Karyawan")

h2(doc, "4.1 Melihat Daftar Karyawan")
para(doc, "Halaman ini menampilkan tabel berisi seluruh data karyawan yang terdaftar di sistem. Setiap baris menampilkan:")
bullet(doc, [
    "Nomor ID / Kode Karyawan",
    "Nama lengkap karyawan",
    "Jabatan / Pekerjaan",
    "Departemen dan Site penempatan",
    "Status karyawan (Aktif / Tidak Aktif)",
    "Tombol aksi: Lihat Detail, Edit, Hapus",
])

h2(doc, "4.2 Mencari & Memfilter Karyawan")
numbered(doc, [
    "Gunakan kotak pencarian di bagian atas tabel untuk mencari berdasarkan nama atau ID",
    "Gunakan filter dropdown untuk menyaring berdasarkan Departemen, Site, atau Status",
    "Klik tombol filter/reset untuk menerapkan atau mengosongkan filter",
])
info_box(doc, "Pencarian bersifat real-time — hasil langsung berubah saat Anda mengetik tanpa perlu menekan Enter.")

h2(doc, "4.3 Menambah Karyawan Baru")
numbered(doc, [
    'Klik tombol "+ Tambah Karyawan" di pojok kanan atas tabel',
    "Form tambah karyawan akan muncul",
    "Isi semua kolom yang wajib diisi (bertanda bintang *): Nama, NIK, Tanggal Lahir, Jenis Kelamin, Jabatan, Departemen, Site, Tipe Kontrak",
    "Isi kolom tambahan sesuai data: nomor telepon, alamat, status pajak, dll.",
    'Klik tombol "Simpan" untuk menyimpan data',
    "Sistem akan menampilkan notifikasi konfirmasi jika data berhasil disimpan",
])
warning_box(doc, "Pastikan NIK (Nomor Induk Karyawan) tidak duplikat. Sistem akan menolak penyimpanan jika NIK sudah terdaftar.")

h2(doc, "4.4 Import Karyawan Massal via Excel")
para(doc, "Untuk menambahkan banyak karyawan sekaligus, gunakan fitur Import Excel:")
numbered(doc, [
    'Klik tombol "Import" di halaman Data Karyawan',
    'Unduh template Excel dengan mengklik "Download Template"',
    "Isi data karyawan pada file Excel template sesuai kolom yang tersedia",
    "Simpan file Excel, lalu upload kembali melalui tombol Import",
    "Sistem akan memvalidasi data dan menampilkan hasil import (berhasil/gagal per baris)",
])
info_box(doc, "Template Excel sudah memiliki format kolom yang benar. Jangan mengubah nama kolom atau urutan kolom pada template.")

h2(doc, "4.5 Melihat Detail Karyawan")
para(doc, "Klik nama karyawan atau ikon 'Lihat Detail' pada baris karyawan untuk membuka halaman detail lengkap.")
img(doc, "04-detail-karyawan.png", "Gambar 4.2 — Halaman Detail Karyawan")
para(doc, "Halaman detail karyawan menampilkan informasi lengkap yang terbagi dalam beberapa tab/bagian:")
bullet(doc, [
    "Informasi Pribadi — nama, NIK, tanggal lahir, jenis kelamin, alamat, kontak",
    "Informasi Pekerjaan — jabatan, departemen, site, tipe karyawan, tanggal mulai kerja",
    "Riwayat Kontrak — daftar semua kontrak yang pernah dan sedang aktif",
    "Dokumen — file-file dokumen yang dilampirkan untuk karyawan ini",
    "Surat Peringatan — riwayat SP yang pernah diterima",
])

h2(doc, "4.6 Mengubah Data Karyawan")
numbered(doc, [
    "Buka halaman detail karyawan",
    'Klik tombol "Edit" di pojok kanan atas halaman detail',
    "Ubah data yang perlu diperbarui pada form yang muncul",
    'Klik "Simpan Perubahan" untuk menyimpan',
])

h2(doc, "4.7 Ekspor Data Karyawan")
numbered(doc, [
    'Klik tombol "Export" di halaman Daftar Karyawan',
    "Pilih format: Excel (.xlsx) atau PDF",
    "File akan langsung diunduh ke komputer Anda",
])
doc.add_page_break()


# ── BAB 5: MANAJEMEN KONTRAK ──────────────────────────────────────────────
h1(doc, "5. Modul Manajemen Kontrak")
para(doc, "Modul ini mengelola seluruh kontrak kerja karyawan, mulai dari pembuatan kontrak baru, perpanjangan, hingga penandatanganan kontrak.")
img(doc, "05-kontrak.png", "Gambar 5.1 — Halaman Manajemen Kontrak")

h2(doc, "5.1 Memahami Status Kontrak")
para(doc, "Setiap kontrak memiliki status yang diperbarui secara otomatis oleh sistem:")
status_table(doc, [
    ("AKTIF",       "C6EFCE", "Kontrak sedang berjalan, sisa masa > 30 hari"),
    ("AKAN HABIS",  "FFEB9C", "Kontrak akan berakhir dalam ≤ 30 hari ke depan"),
    ("EXPIRED",     "FFC7CE", "Tanggal berakhir sudah terlewati, belum diperpanjang"),
    ("SELESAI",     "BDD7EE", "Kontrak telah selesai sesuai ketentuan"),
    ("DIBATALKAN",  "E2EFDA", "Kontrak dibatalkan oleh pihak terkait"),
    ("DRAFT",       "F2F2F2", "Kontrak masih dalam proses penyusunan"),
])
info_box(doc, "Status AKAN HABIS akan memicu notifikasi otomatis kepada admin, sehingga dapat segera dilakukan tindak lanjut perpanjangan.")

h2(doc, "5.2 Melihat Daftar Kontrak")
bullet(doc, [
    "Halaman menampilkan satu baris ringkasan per karyawan beserta status kontrak terkininya",
    "Klik nama karyawan untuk melihat semua riwayat kontraknya",
    "Gunakan filter Status, Tipe Kontrak, atau pencarian nama untuk mempersempit tampilan",
])

h2(doc, "5.3 Membuat Kontrak Baru")
numbered(doc, [
    'Klik tombol "+ Buat Kontrak Baru"',
    "Pilih karyawan dari daftar atau cari berdasarkan nama/ID",
    "Pilih Tipe Kontrak (PKWT Driver, PKWT Staff, PKWT Kasir, PKWT Warehouse, Mitra Driver, dll.)",
    "Tentukan Tanggal Mulai dan Tanggal Berakhir kontrak",
    "Sistem akan mengisi nomor kontrak secara otomatis dengan format: {urutan}/KK/KUKP/SII/{bulan-romawi}/{tahun}",
    'Klik "Simpan" — kontrak tersimpan dengan status DRAFT',
    'Untuk mengaktifkan, klik "Aktifkan Kontrak" setelah semua data benar',
])
warning_box(doc, "Tanggal kontrak tidak boleh tumpang tindih (overlap) dengan kontrak lain yang sudah aktif untuk karyawan yang sama. Sistem akan menolak jika terjadi overlap.")

h2(doc, "5.4 Memperpanjang Kontrak")
para(doc, "Perpanjangan hanya dapat dilakukan untuk kontrak berstatus AKAN HABIS atau EXPIRED:")
numbered(doc, [
    "Cari karyawan yang kontraknya akan habis",
    'Klik tombol "Perpanjang" pada baris kontrak tersebut',
    "Tentukan tanggal mulai baru dan tanggal berakhir baru",
    "Pilih template kontrak yang akan digunakan",
    'Klik "Simpan Perpanjangan"',
])
warning_box(doc, "Karyawan yang memiliki Surat Peringatan 3 (SP3) aktif tidak dapat diperpanjang kontraknya. Selesaikan terlebih dahulu proses SP3 sebelum memperpanjang.")

h2(doc, "5.5 Generate & Unduh Kontrak PDF")
numbered(doc, [
    "Buka detail kontrak karyawan",
    'Klik tombol "Generate PDF" atau "Cetak Kontrak"',
    "Sistem akan membuat dokumen PDF kontrak berdasarkan template yang dipilih",
    "File PDF akan langsung terunduh ke komputer Anda",
])
info_box(doc, "Nomor kontrak dicetak secara otomatis pada dokumen PDF. Setelah kontrak ditandatangani dan di-upload, status kontrak akan terkunci dan tidak bisa diedit.")
doc.add_page_break()


# ── BAB 6: DOKUMEN KARYAWAN ───────────────────────────────────────────────
h1(doc, "6. Modul Dokumen Karyawan")
para(doc, "Modul ini berfungsi sebagai arsip digital untuk dokumen-dokumen milik karyawan, seperti KTP, ijazah, sertifikat, dan dokumen penting lainnya.")
img(doc, "07-dok-karyawan.png", "Gambar 6.1 — Halaman Dokumen Karyawan")

h2(doc, "6.1 Melihat Daftar Dokumen")
bullet(doc, [
    "Halaman menampilkan daftar dokumen yang sudah diunggah untuk setiap karyawan",
    "Kolom yang tampil: Nama Karyawan, Jenis Dokumen, Tanggal Upload, Status, dan Aksi",
    "Gunakan filter Jenis Dokumen atau pencarian nama untuk menemukan dokumen tertentu",
])

h2(doc, "6.2 Mengunggah Dokumen Baru")
numbered(doc, [
    'Klik tombol "+ Upload Dokumen"',
    "Pilih karyawan yang bersangkutan",
    "Pilih Jenis Dokumen dari daftar yang tersedia (KTP, Ijazah, BPJS, dll.)",
    'Klik "Pilih File" dan pilih file dari komputer Anda (format: PDF, JPG, PNG)',
    "Beri catatan/keterangan jika diperlukan",
    'Klik "Upload" untuk menyimpan dokumen',
])
info_box(doc, "Ukuran file maksimum adalah 10 MB per dokumen. Format yang didukung: PDF, JPG, PNG.")

h2(doc, "6.3 Mengunduh & Melihat Dokumen")
numbered(doc, [
    "Cari dokumen yang ingin dilihat menggunakan pencarian atau filter",
    'Klik ikon "Unduh" (ikon panah ke bawah) untuk mengunduh file',
    'Klik ikon "Pratinjau" (ikon mata) untuk melihat dokumen langsung di browser',
])

h2(doc, "6.4 Menghapus Dokumen")
numbered(doc, [
    "Temukan dokumen yang ingin dihapus",
    'Klik ikon "Hapus" (ikon tempat sampah)',
    "Konfirmasi penghapusan pada dialog yang muncul",
])
warning_box(doc, "Penghapusan dokumen bersifat permanen dan tidak dapat dibatalkan. Pastikan dokumen yang dihapus memang sudah tidak diperlukan lagi.")
doc.add_page_break()


# ── BAB 7: SURAT PERINGATAN ───────────────────────────────────────────────
h1(doc, "7. Modul Surat Peringatan (SP)")
para(doc, "Modul ini mengelola penerbitan dan arsip Surat Peringatan (SP) kepada karyawan. Sistem mendukung eskalasi SP1, SP2, dan SP3.")
img(doc, "06-surat-peringatan.png", "Gambar 7.1 — Halaman Surat Peringatan")

h2(doc, "7.1 Memahami Eskalasi SP")
bullet(doc, [
    "SP1 (Peringatan Pertama) — pelanggaran ringan",
    "SP2 (Peringatan Kedua) — pelanggaran yang terulang setelah SP1",
    "SP3 (Peringatan Ketiga/Terakhir) — pelanggaran berat; ketika SP3 aktif, kontrak karyawan tidak dapat diperpanjang",
])
info_box(doc, "Setiap SP berlaku selama 6 bulan sejak tanggal surat diterbitkan. SP yang sudah kadaluarsa (> 6 bulan) tidak lagi menghambat perpanjangan kontrak.")

h2(doc, "7.2 Melihat Daftar SP")
bullet(doc, [
    "Tabel menampilkan semua SP yang pernah diterbitkan",
    "Kolom: Nomor SP, Nama Karyawan, Jenis SP (SP1/SP2/SP3), Tanggal Surat, Berlaku Hingga, Status (Aktif/Kadaluarsa)",
    "Filter berdasarkan Jenis SP, Status, atau nama karyawan tersedia di bagian atas",
])

h2(doc, "7.3 Menerbitkan Surat Peringatan Baru")
numbered(doc, [
    'Klik tombol "+ Buat Surat Peringatan"',
    "Pilih karyawan yang akan menerima SP",
    "Pilih Jenis SP: SP1, SP2, atau SP3",
    "Pilih atau masukkan Tanggal Surat",
    "Isi Alasan/Uraian pelanggaran secara jelas dan singkat",
    "Sistem otomatis mengisi Nomor SP dengan format: {urutan}/SP/KUKP/SII/{bulan-romawi}/{tahun}",
    "Sistem juga otomatis menghitung tanggal Berlaku Hingga (Tanggal Surat + 6 bulan)",
    'Klik "Simpan" untuk menerbitkan SP',
])
warning_box(doc, "Karyawan yang sudah memiliki SP3 yang masih aktif tidak dapat diterbitkan SP baru. Sistem akan menampilkan pesan kesalahan jika hal ini terjadi.")

h2(doc, "7.4 Generate & Unduh SP sebagai PDF")
numbered(doc, [
    "Buka detail SP atau temukan SP pada daftar",
    'Klik tombol "Unduh PDF" atau "Cetak SP"',
    "File PDF Surat Peringatan akan langsung terunduh",
    "Dokumen siap dicetak untuk ditandatangani oleh atasan dan karyawan yang bersangkutan",
])
doc.add_page_break()


# ── BAB 8: SERTIFIKASI & IZIN ─────────────────────────────────────────────
h1(doc, "8. Modul Sertifikasi & Izin")
para(doc, "Modul ini menyimpan dan mengelola dokumen sertifikasi, lisensi, dan izin kerja karyawan, seperti SIM, lisensi forklift, sertifikat K3, dan lainnya.")
img(doc, "08-sertifikasi-ijin.png", "Gambar 8.1 — Halaman Sertifikasi & Izin")

h2(doc, "8.1 Melihat Daftar Sertifikasi")
bullet(doc, [
    "Tabel menampilkan semua sertifikasi yang tercatat per karyawan",
    "Kolom yang tampil: Nama Karyawan, Jenis Sertifikasi, Tanggal Terbit, Tanggal Kadaluarsa, Status",
    "Sertifikasi yang mendekati kadaluarsa akan ditandai dengan warna kuning/merah sebagai peringatan",
])

h2(doc, "8.2 Menambah Sertifikasi Baru")
numbered(doc, [
    'Klik tombol "+ Tambah Sertifikasi"',
    "Pilih karyawan yang bersangkutan",
    "Pilih atau ketik Jenis Sertifikasi (SIM A, SIM B, Sertifikat K3, dll.)",
    "Masukkan Tanggal Terbit dan Tanggal Kadaluarsa",
    "Upload file sertifikat (opsional namun dianjurkan)",
    'Klik "Simpan"',
])
info_box(doc, "Sistem akan secara otomatis mengirimkan notifikasi saat sertifikasi mendekati tanggal kadaluarsa, sehingga dapat segera diperpanjang.")

h2(doc, "8.3 Memperbarui & Menghapus Sertifikasi")
bullet(doc, [
    "Klik ikon Edit (pensil) pada baris sertifikasi untuk memperbarui data",
    "Klik ikon Hapus (tempat sampah) untuk menghapus catatan sertifikasi",
    "Konfirmasi penghapusan pada dialog konfirmasi yang muncul",
])
doc.add_page_break()


# ── BAB 9: DOKUMEN LEGAL ─────────────────────────────────────────────────
h1(doc, "9. Modul Dokumen Legal")
para(doc, "Modul Dokumen Legal terbagi menjadi tiga sub-modul untuk mengelola dokumen-dokumen legal perusahaan dan koperasi.")

h2(doc, "9.1 Kontrak Customer / Vendor")
img(doc, "09-kontrak-vendor.png", "Gambar 9.1 — Halaman Kontrak Vendor")
para(doc, "Sub-modul ini menyimpan kontrak kerja sama dengan customer, vendor, atau mitra bisnis eksternal.")
bullet(doc, [
    "Tampilkan daftar kontrak vendor yang aktif dan arsip kontrak lama",
    "Upload dokumen kontrak dalam format PDF",
    "Catat informasi penting: nama vendor, tanggal mulai, tanggal berakhir, nilai kontrak",
    "Download dokumen kapan saja dari daftar",
])
numbered(doc, [
    'Klik "+ Tambah Kontrak Vendor" untuk menambah kontrak baru',
    "Isi form: Nama Vendor/Customer, Nomor Kontrak, Tanggal, Keterangan",
    "Upload file PDF kontrak",
    'Klik "Simpan"',
])

h2(doc, "9.2 Legal Koperasi")
img(doc, "10-legal-koperasi.png", "Gambar 9.2 — Halaman Legal Koperasi")
para(doc, "Menyimpan dokumen legal resmi koperasi, seperti peraturan internal, kebijakan, dan dokumen hukum lainnya.")
bullet(doc, [
    "Arsip dokumen regulasi dan kebijakan koperasi",
    "Dapat diakses oleh semua pengguna yang berwenang",
    "Mendukung upload PDF, Word, dan format dokumen umum lainnya",
])

h2(doc, "9.3 Akte Dokumen")
img(doc, "11-akte-dokumen.png", "Gambar 9.3 — Halaman Akte Dokumen")
para(doc, "Sub-modul untuk menyimpan akte pendirian, akte perubahan, dan dokumen notaris resmi koperasi.")
bullet(doc, [
    "Simpan akte pendirian dan perubahan koperasi secara digital",
    "Mudah dicari dan diunduh saat diperlukan untuk keperluan audit atau legalitas",
    "Upload file dengan nama deskriptif agar mudah ditemukan",
])
doc.add_page_break()


# ── BAB 10: NOTIFIKASI ────────────────────────────────────────────────────
h1(doc, "10. Modul Notifikasi")
para(doc, "Sistem KOKARSI mengirimkan notifikasi otomatis untuk membantu Anda memantau hal-hal penting yang membutuhkan tindakan segera.")
img(doc, "12-notifikasi.png", "Gambar 10.1 — Halaman Notifikasi")

h2(doc, "10.1 Jenis Notifikasi")
bullet(doc, [
    "Kontrak Akan Habis — muncul saat kontrak karyawan tersisa ≤ 30 hari",
    "Sertifikasi Kadaluarsa — peringatan sertifikat/izin yang mendekati expired",
    "Kontrak Expired — pemberitahuan bahwa kontrak sudah melewati tanggal berakhir",
    "Pengingat lainnya yang dikonfigurasi oleh administrator",
])

h2(doc, "10.2 Cara Menggunakan Halaman Notifikasi")
numbered(doc, [
    'Klik menu "Notifikasi" di sidebar kiri',
    "Halaman menampilkan semua notifikasi yang masuk, diurutkan dari yang terbaru",
    "Klik pada notifikasi untuk langsung diarahkan ke data terkait (misal: klik notifikasi kontrak → halaman detail kontrak karyawan tersebut)",
    'Klik tombol "Tandai Semua Dibaca" untuk membersihkan tanda notifikasi baru',
])
info_box(doc, "Ikon lonceng di bagian atas layar juga menampilkan jumlah notifikasi yang belum dibaca. Klik ikon tersebut sebagai akses cepat ke halaman Notifikasi.")
doc.add_page_break()


# ── BAB 11: PENGATURAN ────────────────────────────────────────────────────
h1(doc, "11. Modul Pengaturan")
para(doc, "Modul Pengaturan hanya dapat diakses oleh pengguna dengan role Master Admin. Berisi konfigurasi sistem, master data, template kontrak, dan manajemen pengguna.")

h2(doc, "11.1 Pengaturan Umum")
img(doc, "13-pengaturan-umum.png", "Gambar 11.1 — Halaman Pengaturan Umum")
para(doc, "Terdiri dari beberapa tab pengaturan:")

h3(doc, "Tab Umum")
bullet(doc, [
    "Nama organisasi / koperasi",
    "Logo dan branding sistem",
    "Zona waktu dan pengaturan regional",
])

h3(doc, "Tab Profil Akun")
bullet(doc, [
    "Ubah nama tampilan akun Anda",
    "Ganti foto profil",
    "Perbarui alamat email",
])

h3(doc, "Tab Tampilan Login")
bullet(doc, [
    "Kustomisasi tampilan halaman login (logo, warna, teks sambutan)",
    "Preview tampilan sebelum disimpan",
])

h3(doc, "Tab Konfigurasi Email")
bullet(doc, [
    "Atur server SMTP untuk pengiriman email notifikasi",
    "Masukkan host SMTP, port, username, dan password",
    "Kirim email percobaan untuk memverifikasi konfigurasi",
])
info_box(doc, "Konfigurasi email diperlukan agar sistem dapat mengirimkan notifikasi kontrak dan sertifikasi secara otomatis ke email admin.")

h2(doc, "11.2 Master Data")
img(doc, "14-master-data.png", "Gambar 11.2 — Halaman Master Data")
para(doc, "Master Data berisi daftar referensi yang digunakan di seluruh sistem. Terdiri dari 8 kategori:")
tbl_md = doc.add_table(rows=9, cols=2)
tbl_md.style = 'Table Grid'
md_headers = ["Kategori Master Data", "Fungsi"]
for i, h in enumerate(md_headers):
    tbl_md.rows[0].cells[i].text = h
    tbl_md.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    tbl_md.rows[0].cells[i].paragraphs[0].runs[0].font.size = Pt(10)
    tc = tbl_md.rows[0].cells[i]._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '2E74B5')
    tcPr.append(shd)
    tbl_md.rows[0].cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(255,255,255)

md_rows = [
    ("Site", "Daftar lokasi/cabang tempat karyawan bertugas"),
    ("Departemen", "Daftar departemen dalam organisasi"),
    ("Pekerjaan", "Daftar jenis/nama pekerjaan/jabatan"),
    ("Level Jabatan", "Tingkatan jabatan (Staff, Supervisor, Manager, dll.)"),
    ("Tipe Kontrak", "Jenis kontrak kerja yang tersedia (PKWT, PKWTT, Mitra, dll.)"),
    ("Status Pajak", "Daftar status pajak karyawan (TK/0, K/0, K/1, dll.)"),
    ("Jenis Dokumen", "Kategori dokumen yang dapat diunggah"),
    ("Perusahaan", "Data perusahaan/entitas hukum yang terlibat"),
]
for i, (k, v) in enumerate(md_rows):
    tbl_md.rows[i+1].cells[0].text = k
    tbl_md.rows[i+1].cells[1].text = v
    for j in range(2):
        tbl_md.rows[i+1].cells[j].paragraphs[0].runs[0].font.size = Pt(10)
doc.add_paragraph()

para(doc, "Cara menambah, mengubah, atau menghapus data master:")
numbered(doc, [
    "Pilih kategori master data yang ingin dikelola dari tab di bagian atas halaman",
    'Klik "+ Tambah" untuk menambah data baru',
    "Isi nama/kode dan keterangan pada form yang muncul",
    'Klik "Simpan"',
    "Untuk mengubah, klik ikon Edit pada baris data yang ingin diubah",
    "Untuk menghapus, klik ikon Hapus — data hanya bisa dihapus jika tidak sedang digunakan",
])
warning_box(doc, "Perubahan pada Master Data akan langsung berdampak ke seluruh data karyawan dan kontrak yang menggunakan nilai tersebut. Lakukan perubahan dengan hati-hati.")

h2(doc, "11.3 Template Kontrak")
img(doc, "15-template-kontrak.png", "Gambar 11.3 — Halaman Template Kontrak")
para(doc, "Template kontrak adalah dokumen Word (.docx) berisi variabel placeholder yang secara otomatis diisi oleh sistem saat membuat kontrak PDF.")
para(doc, "Sistem menyediakan 8 template default:")
bullet(doc, [
    "MITRA_DRIVER — Kontrak Kerja Mitra Driver",
    "MITRA_KOMART — Kontrak Kerja Mitra Komart",
    "MITRA_STAFF — Kontrak Kerja Mitra Staff",
    "MITRA_WAREHOUSE — Kontrak Kerja Mitra Warehouse",
    "PKWT_DRIVER — PKWT (Perjanjian Kerja Waktu Tertentu) Driver",
    "PKWT_KASIR — PKWT Kasir",
    "PKWT_STAFF — PKWT Staff",
    "PKWT_WAREHOUSE — PKWT Warehouse",
])
para(doc, "Cara mengelola template:")
numbered(doc, [
    "Pilih template yang ingin diperbarui dari daftar",
    'Klik "Download" untuk mengunduh template saat ini',
    "Edit template menggunakan Microsoft Word — jangan hapus variabel placeholder yang ada (format: {{nama_variabel}})",
    'Klik "Upload Template Baru" dan pilih file .docx yang sudah diedit',
    "Sistem akan mengganti template lama dengan yang baru",
])
warning_box(doc, "Jangan menghapus variabel placeholder seperti {{nama_karyawan}}, {{tanggal_mulai}}, dll. Variabel ini diisi otomatis oleh sistem saat generate PDF kontrak.")

h2(doc, "11.4 Manajemen User")
img(doc, "16-settings-users.png", "Gambar 11.4 — Halaman Manajemen User")
para(doc, "Di sini Master Admin dapat membuat, mengubah, atau menonaktifkan akun pengguna sistem.")

h3(doc, "Menambah User Baru")
numbered(doc, [
    'Klik tombol "+ Tambah User"',
    "Isi form: Username, Password awal, Nama Lengkap, Email, Role (Master Admin / Pengelola Koperasi)",
    'Klik "Simpan"',
    "User baru dapat langsung login menggunakan username dan password yang dibuat",
])

h3(doc, "Mengubah & Menonaktifkan User")
bullet(doc, [
    "Klik ikon Edit pada baris user untuk mengubah nama, email, atau role",
    "Untuk menonaktifkan akun tanpa menghapus, klik toggle Status pada baris user",
    "User yang dinonaktifkan tidak dapat login sampai diaktifkan kembali",
])

h3(doc, "Mengganti Password User")
numbered(doc, [
    "Buka halaman edit user",
    "Centang opsi 'Ganti Password'",
    "Masukkan password baru dan konfirmasi password",
    'Klik "Simpan"',
])
info_box(doc, "Gunakan password yang kuat dengan kombinasi huruf besar, huruf kecil, angka, dan simbol. Panjang minimal 8 karakter.")

h2(doc, "11.5 Log Aktivitas")
para(doc, "Sistem mencatat semua aktivitas pengguna untuk keperluan audit dan keamanan. Log dapat diakses melalui menu Pengaturan > Log Aktivitas.")
bullet(doc, [
    "Menampilkan siapa melakukan apa dan kapan",
    "Dapat difilter berdasarkan pengguna, tanggal, dan jenis aksi",
    "Berguna untuk investigasi jika terjadi perubahan data yang tidak diinginkan",
])
doc.add_page_break()


# ── BAB 12: FAQ ───────────────────────────────────────────────────────────
h1(doc, "12. Pertanyaan Umum (FAQ)")

faq_items = [
    (
        "Saya tidak bisa login, apa yang harus dilakukan?",
        [
            "Pastikan username dan password yang dimasukkan sudah benar (huruf besar/kecil berpengaruh)",
            "Pastikan koneksi internet Anda stabil",
            "Coba bersihkan cache browser: tekan Ctrl+Shift+Delete > pilih 'Cached images and files' > Clear data",
            "Jika masih tidak bisa, hubungi administrator untuk reset password",
        ]
    ),
    (
        "Kontrak karyawan berstatus AKAN HABIS, apa yang harus saya lakukan?",
        [
            "Segera koordinasi dengan atasan terkait keputusan perpanjangan atau pengakhiran kontrak",
            "Jika diperpanjang, buka halaman detail karyawan > klik 'Perpanjang Kontrak'",
            "Jika tidak diperpanjang, tidak perlu tindakan — status akan berubah otomatis menjadi EXPIRED",
        ]
    ),
    (
        "Saya tidak bisa membuat SP untuk karyawan, muncul pesan error",
        [
            "Kemungkinan karyawan tersebut sudah memiliki SP3 yang masih aktif (berlaku < 6 bulan)",
            "Cek tab Surat Peringatan pada halaman detail karyawan",
            "SP3 yang aktif mengunci penerbitan SP baru — tunggu sampai SP3 kadaluarsa atau selesaikan proses PHK terlebih dahulu",
        ]
    ),
    (
        "Apakah data yang sudah dihapus bisa dikembalikan?",
        [
            "Penghapusan data bersifat permanen dan tidak dapat dikembalikan melalui sistem",
            "Pastikan selalu melakukan konfirmasi ulang sebelum menghapus data",
            "Untuk data penting, pertimbangkan untuk menonaktifkan (ubah status) daripada menghapus",
        ]
    ),
    (
        "Bagaimana cara mencetak laporan data karyawan?",
        [
            "Buka halaman Data Karyawan",
            "Klik tombol 'Export' dan pilih format PDF atau Excel",
            "File akan diunduh dan dapat dibuka/dicetak menggunakan aplikasi yang sesuai",
        ]
    ),
    (
        "Sistem terasa lambat, apa penyebabnya?",
        [
            "Cek koneksi internet Anda — sistem membutuhkan koneksi yang stabil",
            "Tutup tab browser yang tidak diperlukan untuk menghemat memori",
            "Coba refresh halaman dengan menekan F5",
            "Jika masalah berlanjut, hubungi administrator sistem",
        ]
    ),
    (
        "Apakah sistem bisa diakses dari ponsel/tablet?",
        [
            "Ya, sistem KOKARSI mendukung akses via browser di ponsel atau tablet",
            "Gunakan browser terbaru (Chrome, Safari, Firefox) untuk pengalaman terbaik",
            "Tampilan akan menyesuaikan ukuran layar secara otomatis (responsive)",
        ]
    ),
]

for q, answers in faq_items:
    p = doc.add_paragraph()
    run = p.add_run("T: " + q)
    run.bold = True
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after  = Pt(2)
    
    p2 = doc.add_paragraph()
    run2 = p2.add_run("J:")
    run2.bold = True
    run2.font.size = Pt(11)
    p2.paragraph_format.space_after = Pt(2)
    
    for ans in answers:
        pb = doc.add_paragraph(style='List Bullet')
        r = pb.add_run(ans)
        r.font.size = Pt(10.5)
        pb.paragraph_format.space_after = Pt(2)
    doc.add_paragraph()

doc.add_page_break()

# ── PENUTUP ───────────────────────────────────────────────────────────────
h1(doc, "Informasi Kontak & Bantuan")
para(doc, "Jika Anda mengalami masalah atau membutuhkan bantuan yang tidak tercakup dalam panduan ini, silakan hubungi:")
tbl_kontak = doc.add_table(rows=4, cols=2)
tbl_kontak.style = 'Table Grid'
kontak_rows = [
    ("Administrator Sistem", "Tim IT / Pengembang KOKARSI"),
    ("Email", "admin@kokarsi-sankyu.web.id"),
    ("Website Sistem", "https://kokarsi-sankyu.web.id"),
    ("Jam Layanan", "Senin–Jumat, 08.00–17.00 WIB"),
]
for i, (k, v) in enumerate(kontak_rows):
    tbl_kontak.rows[i].cells[0].text = k
    tbl_kontak.rows[i].cells[0].paragraphs[0].runs[0].bold = True
    tbl_kontak.rows[i].cells[0].paragraphs[0].runs[0].font.size = Pt(10)
    tbl_kontak.rows[i].cells[1].text = v
    tbl_kontak.rows[i].cells[1].paragraphs[0].runs[0].font.size = Pt(10)

doc.add_paragraph()
p_end = doc.add_paragraph()
p_end.alignment = WD_ALIGN_PARAGRAPH.CENTER
run_end = p_end.add_run("— Selesai —")
run_end.font.size = Pt(12)
run_end.font.italic = True
run_end.font.color.rgb = RGBColor(0x77,0x77,0x77)

# SAVE
doc.save(OUTPUT)
print(f"OK: {OUTPUT}")
