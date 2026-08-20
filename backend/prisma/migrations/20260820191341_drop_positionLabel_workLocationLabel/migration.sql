-- Hapus kolom positionLabel & workLocationLabel dari tabel contracts
-- Kedua field tidak pernah dirender ke dokumen PDF (hanya tersimpan di DB)
ALTER TABLE "contracts" DROP COLUMN "positionLabel";
ALTER TABLE "contracts" DROP COLUMN "workLocationLabel";
