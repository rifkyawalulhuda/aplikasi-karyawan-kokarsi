const { existsSync, readdirSync, statSync, unlinkSync } = require('fs');
const { join } = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanup() {
  const uploadsRoot = join(process.cwd(), 'uploads');
  console.log('Uploads root:', uploadsRoot);
  if (!existsSync(uploadsRoot)) {
    console.log('No uploads directory found');
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    const [empDocs, warnLetters, legal, vendor, akte, employees, contracts] = await Promise.all([
      client.query('SELECT "fileUrl" FROM employee_documents WHERE "fileUrl" IS NOT NULL'),
      client.query('SELECT "documentUrl" FROM warning_letters WHERE "documentUrl" IS NOT NULL'),
      client.query('SELECT "fileUrl" FROM legal_koperasi WHERE "fileUrl" IS NOT NULL'),
      client.query('SELECT "fileUrl" FROM vendor_contracts WHERE "fileUrl" IS NOT NULL'),
      client.query('SELECT file_url FROM akte_dokumen WHERE file_url IS NOT NULL'),
      client.query('SELECT "fotoKaryawan" FROM employees WHERE "fotoKaryawan" IS NOT NULL'),
      client.query('SELECT "documentUrl", "generatedPdfUrl" FROM contracts'),
    ]);

    const activePaths = new Set();
    const addPath = (url) => {
      if (url) activePaths.add(url.startsWith('/') ? url.slice(1) : url);
    };

    empDocs.rows.forEach(r => addPath(r.fileUrl));
    warnLetters.rows.forEach(r => addPath(r.documentUrl));
    legal.rows.forEach(r => addPath(r.fileUrl));
    vendor.rows.forEach(r => addPath(r.fileUrl));
    akte.rows.forEach(r => addPath(r.file_url));
    employees.rows.forEach(r => addPath(r.fotoKaryawan));
    contracts.rows.forEach(r => { addPath(r.documentUrl); addPath(r.generatedPdfUrl); });

    console.log('Active file paths in DB:', activePaths.size);
    if (activePaths.size > 0) {
      console.log('Sample active paths:', [...activePaths].slice(0, 3));
    }

    let deleted = 0, active = 0, recent = 0, scanned = 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago

    const scanDir = (dir, relBase) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const rel = relBase + '/' + entry;
        const stat = statSync(full);
        if (stat.isDirectory()) {
          scanDir(full, rel);
        } else if (stat.isFile() && entry !== '.gitkeep') {
          scanned++;
          if (activePaths.has(rel)) {
            active++;
          } else if (stat.mtimeMs >= cutoff) {
            recent++;
            console.log('SKIP (too recent <24h):', rel);
          } else {
            try {
              unlinkSync(full);
              deleted++;
              console.log('DELETED orphan:', rel);
            } catch (e) {
              console.log('FAILED to delete:', rel, e.message);
            }
          }
        }
      }
    };

    scanDir(uploadsRoot, 'uploads');

    console.log('\n=== Cleanup Summary ===');
    console.log('Files scanned   :', scanned);
    console.log('Active (in DB)  :', active);
    console.log('Deleted (orphan):', deleted);
    console.log('Skipped (recent):', recent);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch(e => {
  console.error('Cleanup failed:', e.message);
  process.exit(1);
});
