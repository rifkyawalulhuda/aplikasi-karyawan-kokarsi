-- Fix notification deeplinks to use ?openId= pattern for direct deep-link navigation

-- KONTRAK_KARYAWAN: dari /karyawan/:employeeId → /kontrak?openId=:contractId
UPDATE notifications
SET deeplink = CONCAT('/kontrak?openId=', "sourceId")
WHERE category = 'KONTRAK_KARYAWAN';

-- SERTIFIKASI_IJIN: dari /dokumen/dok-karyawan?status=... → /dokumen/sertifikasi-ijin?openId=:docId
UPDATE notifications
SET deeplink = CONCAT('/dokumen/sertifikasi-ijin?openId=', "sourceId")
WHERE category = 'SERTIFIKASI_IJIN';

-- KONTRAK_VENDOR: dari /dokumen-legal/kontrak-vendor?status=... → /dokumen-legal/kontrak-vendor?openId=:vendorId
UPDATE notifications
SET deeplink = CONCAT('/dokumen-legal/kontrak-vendor?openId=', "sourceId")
WHERE category = 'KONTRAK_VENDOR';

-- LEGAL_KOPERASI: dari /dokumen-legal/legal-koperasi?status=... → /dokumen-legal/legal-koperasi?openId=:legalId
UPDATE notifications
SET deeplink = CONCAT('/dokumen-legal/legal-koperasi?openId=', "sourceId")
WHERE category = 'LEGAL_KOPERASI';
