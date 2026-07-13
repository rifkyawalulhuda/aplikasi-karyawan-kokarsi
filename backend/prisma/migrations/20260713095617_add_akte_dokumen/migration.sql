-- DropTable (old camelCase columns)
DROP TABLE IF EXISTS "akte_dokumen";

-- CreateTable with snake_case columns
CREATE TABLE "akte_dokumen" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "notaris" VARCHAR(255) NOT NULL,
    "nomor_akte" VARCHAR(100) NOT NULL,
    "judul_akte" VARCHAR(255) NOT NULL,
    "nomor_sk" VARCHAR(100),
    "tanggal_sk" DATE,
    "keterangan" TEXT,
    "file_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "akte_dokumen_pkey" PRIMARY KEY ("id")
);
