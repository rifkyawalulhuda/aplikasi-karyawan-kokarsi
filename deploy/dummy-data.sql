-- =============================================================================
-- DUMMY DATA for Kokarsi PT. Sankyu - Testing Pagination
-- Cara pakai (Docker):
--   docker cp deploy/dummy-data.sql kokarsi-postgres:/tmp/dummy-data.sql
--   docker exec kokarsi-postgres psql -U kokarsi -d kokarsi_karyawan -f /tmp/dummy-data.sql
-- =============================================================================

BEGIN;

-- ── 1. EMPLOYEES (50 dummy) ──────────────────────────────────────────────────
DO $$
DECLARE
  v_wl INT[]; v_jr INT[]; v_jl INT[]; v_ts INT[]; v_dp INT[];
  i INT;
  v_names TEXT[] := ARRAY[
    'Ahmad Fauzi','Siti Rahayu','Dedi Kurniawan','Rini Wulandari','Hendra Gunawan',
    'Dewi Anggraini','Bambang Susilo','Fitri Handayani','Rizky Pratama','Yuli Astuti',
    'Agus Setiawan','Nia Permata','Wahyu Hidayat','Sri Mulyani','Faisal Rahman',
    'Lestari Ningrum','Supardi Santoso','Mira Kusuma','Doni Prasetyo','Ratna Sari',
    'Irwan Syahputra','Endah Puspita','Taufik Hidayat','Winda Lestari','Hendro Susanto',
    'Asri Budianti','Fajar Nugroho','Putri Ramadhani','Lukman Hakim','Novia Sari',
    'Eko Prasetyo','Indah Permatasari','Budi Hermawan','Yayuk Sulistyowati','Arif Budiman',
    'Citra Dewi','Guntur Wibowo','Laila Fitriani','Hadi Santoso','Meilani Putri',
    'Surya Dharma','Fitriana Dewi','Rudi Hartono','Anggun Rahayu','Dimas Saputra',
    'Suci Handayani','Firmansyah Putra','Novita Anggraeni','Santoso Widjaja','Herlinah Susanti'
  ];
BEGIN
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_wl FROM work_locations;
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_jr FROM job_roles;
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_jl FROM job_levels;
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_ts FROM tax_status;
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_dp FROM departments;
  FOR i IN 1..50 LOOP
    INSERT INTO employees (
      "employeeNo","fullName","employmentStatus","gender","birthDate","joinDate",
      "email","phoneNumber","educationLevel",
      "workLocationId","jobRoleId","jobLevelId","taxStatusId","departmentId",
      "createdAt","updatedAt"
    ) VALUES (
      'EMP' || LPAD((i+1)::TEXT,3,'0'),
      v_names[i],
      'AKTIF'::"EmploymentStatus",
      CASE WHEN i%2=0 THEN 'MALE'::"Gender" ELSE 'FEMALE'::"Gender" END,
      '1986-01-01'::DATE + ((i*127)%3650),
      '2019-01-01'::DATE + ((i*73)%1825),
      LOWER(REPLACE(v_names[i],' ','.')) || '@sankyu.co.id',
      '0812' || LPAD((10000000+i)::TEXT,8,'0'),
      CASE (((i-1)%8)+1)
        WHEN 1 THEN 'S1'::"EducationLevel" WHEN 2 THEN 'D3'::"EducationLevel"
        WHEN 3 THEN 'SMA'::"EducationLevel" WHEN 4 THEN 'S1'::"EducationLevel"
        WHEN 5 THEN 'S2'::"EducationLevel" WHEN 6 THEN 'D3'::"EducationLevel"
        WHEN 7 THEN 'SMA'::"EducationLevel" ELSE 'S1'::"EducationLevel"
      END,
      v_wl[((i-1)%array_length(v_wl,1))+1],
      v_jr[((i-1)%array_length(v_jr,1))+1],
      v_jl[((i-1)%array_length(v_jl,1))+1],
      v_ts[((i-1)%array_length(v_ts,1))+1],
      v_dp[((i-1)%array_length(v_dp,1))+1],
      NOW(),NOW()
    ) ON CONFLICT ("employeeNo") DO NOTHING;
  END LOOP;
END $$;

-- ── 2. COMPANIES (8 dummy) ───────────────────────────────────────────────────
INSERT INTO companies (name,address,email,phone) VALUES
  ('PT Maju Bersama Logistik','Jl. Industri Raya No.12, Jakarta Utara','info@majubersama.co.id','02144001234'),
  ('CV Karya Mandiri Teknik','Jl. Raya Bekasi KM 28, Cikarang','cs@karyamandiri.id','02188005678'),
  ('PT Sumber Daya Prima','Jl. HR Rasuna Said Kav 5, Jakarta Selatan','info@sdprima.com','02150001234'),
  ('PT Global Nusantara Shipping','Jl. Pelabuhan No.99, Tanjung Priok','contact@gnshipping.co.id','02143210000'),
  ('CV Teknindo Perkasa','Jl. Pabrik Raya No.7, Karawang','teknindo@gmail.com','02670987654'),
  ('PT Aneka Usaha Koperasi','Jl. Koperasi Maju No.3, Jakarta Pusat','auk@kopindo.org','02138880000'),
  ('PT Cipta Niaga Utama','Jl. Gatot Subroto No.55, Jakarta Selatan','info@ciptaniaga.co.id','02152001122'),
  ('CV Harapan Jaya Trans','Jl. Trans Nasional KM 5, Bogor','hjt@harapanjaya.id','02513334455');

-- ── 3. DOCUMENT TYPES CERTIFICATION (6 dummy) ───────────────────────────────
INSERT INTO document_types (name,"documentType",issuer,category) VALUES
  ('Sertifikat K3 Umum','SERTIFIKAT_K3','Kementerian Ketenagakerjaan','CERTIFICATION'),
  ('SIO Forklift','SIO_FORKLIFT','Dinas Ketenagakerjaan Provinsi','CERTIFICATION'),
  ('SIO Overhead Crane','SIO_CRANE','Dinas Ketenagakerjaan Provinsi','CERTIFICATION'),
  ('Sertifikat Keamanan Pangan','SERTIFIKAT_PANGAN','BPOM','CERTIFICATION'),
  ('Sertifikat Operator Alat Berat','SERTIFIKAT_ALAT_BERAT','Kementerian Ketenagakerjaan','CERTIFICATION'),
  ('Lisensi Pengemudi B2','LISENSI_B2','Kepolisian Republik Indonesia','CERTIFICATION');

-- ── 4. CONTRACTS (50 dummy) ──────────────────────────────────────────────────
DO $$
DECLARE
  v_emp INT[]; v_ct INT[];
  v_emp_id INT; v_ct_id INT;
  i INT; v_start DATE; v_end DATE; v_status "ContractStatus";
  v_statuses TEXT[] := ARRAY['AKTIF','AKTIF','AKTIF','AKAN_HABIS','EXPIRED','SELESAI'];
BEGIN
  SELECT ARRAY_AGG(id ORDER BY "employeeNo") INTO v_emp
  FROM employees WHERE "employeeNo" LIKE 'EMP0%' AND "employeeNo"!='EMP001';
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_ct FROM contract_types;
  FOR i IN 1..50 LOOP
    v_emp_id := v_emp[((i-1)%array_length(v_emp,1))+1];
    v_ct_id  := v_ct[((i-1)%array_length(v_ct,1))+1];
    v_status := v_statuses[((i-1)%6)+1]::"ContractStatus";
    IF v_status='AKTIF'::"ContractStatus" THEN
      v_start:='2024-01-01'::DATE+((i-1)*7); v_end:=v_start+INTERVAL'2 years';
    ELSIF v_status='AKAN_HABIS'::"ContractStatus" THEN
      v_start:='2024-01-01'::DATE; v_end:=CURRENT_DATE+((i%20)+5);
    ELSIF v_status='EXPIRED'::"ContractStatus" THEN
      v_start:='2022-01-01'::DATE+((i-1)*7); v_end:='2023-06-01'::DATE+((i-1)*5);
    ELSE
      v_start:='2021-01-01'::DATE+((i-1)*14); v_end:='2023-01-01'::DATE+((i-1)*10);
    END IF;
    INSERT INTO contracts("employeeId","contractNo","startDate","endDate","contractTypeId",
      status,"signedDate","positionLabel","workLocationLabel","baseCompensation","createdAt","updatedAt")
    VALUES(v_emp_id,'KTR/DUMMY/'||LPAD(i::TEXT,3,'0'),v_start,v_end,v_ct_id,v_status,v_start,
      CASE (i%4) WHEN 0 THEN 'Staff Admin' WHEN 1 THEN 'Operator' WHEN 2 THEN 'Driver' ELSE 'Mitra' END,
      CASE ((i-1)%3) WHEN 0 THEN 'Sankyu HO' WHEN 1 THEN 'Sankyu Jababeka' ELSE 'Sankyu Rapindo' END,
      4000000+(i*150000),NOW(),NOW())
    ON CONFLICT ("contractNo") DO NOTHING;
  END LOOP;
END $$;

-- ── 5. DOK KARYAWAN PERSONAL (50 dummy) ─────────────────────────────────────
DO $$
DECLARE
  v_emp INT[]; v_dt INT[];
  v_emp_id INT; v_dt_id INT;
  i INT; v_expiry DATE; v_status "DocStatus";
BEGIN
  SELECT ARRAY_AGG(id ORDER BY "employeeNo") INTO v_emp
  FROM employees WHERE "employeeNo" LIKE 'EMP0%' AND "employeeNo"!='EMP001';
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_dt FROM document_types WHERE category='PERSONAL';
  IF v_dt IS NULL THEN RAISE NOTICE 'No PERSONAL doc types'; RETURN; END IF;
  FOR i IN 1..50 LOOP
    v_emp_id:=v_emp[((i-1)%array_length(v_emp,1))+1];
    v_dt_id:=v_dt[((i-1)%array_length(v_dt,1))+1];
    IF (i%5)=0 THEN v_expiry:=NULL; v_status:='AKTIF'::"DocStatus";
    ELSIF (i%4)=0 THEN v_expiry:=CURRENT_DATE-((i%90)+1); v_status:='EXPIRED'::"DocStatus";
    ELSIF (i%7)=0 THEN v_expiry:=CURRENT_DATE+((i%25)+3); v_status:='AKAN_EXPIRED'::"DocStatus";
    ELSE v_expiry:=CURRENT_DATE+((i*30)+90); v_status:='AKTIF'::"DocStatus";
    END IF;
    INSERT INTO employee_documents("employeeId","documentTypeId","documentNumber","expiryDate",status,"createdAt","updatedAt")
    VALUES(v_emp_id,v_dt_id,'DKDUM'||LPAD(i::TEXT,6,'0'),v_expiry,v_status,NOW(),NOW());
  END LOOP;
END $$;

-- ── 6. SURAT PERINGATAN (50 dummy) ───────────────────────────────────────────
DO $$
DECLARE
  v_emp INT[]; v_emp_id INT; i INT;
  v_letter_date DATE; v_valid_until DATE;
  v_admin_id INT; v_admin_name TEXT;
  v_violations TEXT[] := ARRAY[
    'Ketidakhadiran tanpa keterangan','Pelanggaran prosedur keselamatan',
    'Keterlambatan berulang','Tidak mematuhi instruksi atasan',
    'Kerusakan aset perusahaan','Perkelahian di lingkungan kerja',
    'Penyalahgunaan wewenang','Ketidakhadiran melebihi batas toleransi',
    'Pelanggaran kode etik','Pencurian aset perusahaan'
  ];
BEGIN
  SELECT ARRAY_AGG(id ORDER BY "employeeNo") INTO v_emp
  FROM employees WHERE "employeeNo" LIKE 'EMP0%' AND "employeeNo"!='EMP001';
  SELECT id,"fullName" INTO v_admin_id,v_admin_name FROM master_admin LIMIT 1;
  FOR i IN 1..50 LOOP
    v_emp_id:=v_emp[((i-1)%array_length(v_emp,1))+1];
    v_letter_date:='2023-01-01'::DATE+((i-1)*7);
    v_valid_until:=v_letter_date+INTERVAL'6 months';
    INSERT INTO warning_letters("letterNumber","employeeId","violationType","warningLevel",
      "letterDate","validUntil","processedById","processedByName","createdAt","updatedAt")
    VALUES('SP/DUMMY/'||LPAD(i::TEXT,3,'0'),v_emp_id,
      ARRAY[v_violations[((i-1)%10)+1]],((i-1)%3)+1,
      v_letter_date,v_valid_until,v_admin_id,v_admin_name,NOW(),NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ── 7. SERTIFIKASI & IJIN CERTIFICATION (50 dummy) ──────────────────────────
DO $$
DECLARE
  v_emp INT[]; v_ct INT[];
  v_emp_id INT; v_ct_id INT;
  i INT; v_expiry DATE; v_status "DocStatus";
BEGIN
  SELECT ARRAY_AGG(id ORDER BY "employeeNo") INTO v_emp
  FROM employees WHERE "employeeNo" LIKE 'EMP0%' AND "employeeNo"!='EMP001';
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_ct FROM document_types WHERE category='CERTIFICATION';
  IF v_ct IS NULL THEN RAISE NOTICE 'No CERTIFICATION doc types'; RETURN; END IF;
  FOR i IN 1..50 LOOP
    v_emp_id:=v_emp[((i-1)%array_length(v_emp,1))+1];
    v_ct_id:=v_ct[((i-1)%array_length(v_ct,1))+1];
    IF (i%4)=0 THEN v_expiry:=CURRENT_DATE-((i%60)+1); v_status:='EXPIRED'::"DocStatus";
    ELSIF (i%7)=0 THEN v_expiry:=CURRENT_DATE+((i%25)+3); v_status:='AKAN_EXPIRED'::"DocStatus";
    ELSE v_expiry:=CURRENT_DATE+((i*20)+180); v_status:='AKTIF'::"DocStatus";
    END IF;
    INSERT INTO employee_documents("employeeId","documentTypeId","documentNumber","expiryDate",
      status,notes,"createdAt","updatedAt")
    VALUES(v_emp_id,v_ct_id,'SRTDUM'||LPAD(i::TEXT,6,'0'),v_expiry,v_status,
      CASE (i%3) WHEN 0 THEN 'Perlu perpanjangan tahunan' WHEN 1 THEN 'Diterbitkan lembaga terakreditasi' ELSE NULL END,
      NOW(),NOW());
  END LOOP;
END $$;

-- ── 8. VENDOR CONTRACTS (50 dummy) ──────────────────────────────────────────
DO $$
DECLARE
  v_co INT[]; v_co_id INT;
  i INT; v_created DATE; v_start DATE; v_end DATE;
  v_status "VendorContractStatus"; v_cat "VendorContractCategory"; v_dt "VendorDocType";
  v_needs BOOLEAN;
  v_sts TEXT[] := ARRAY['AKTIF','AKTIF','AKAN_BERAKHIR','EXPIRED','TIDAK_AKTIF'];
  v_cats TEXT[] := ARRAY['CUSTOMER','VENDOR','CUSTOMER','VENDOR','CUSTOMER'];
  v_dts TEXT[] := ARRAY['DOKUMEN_KONTRAK','DOKUMEN_PERJANJIAN','SURAT_PENAWARAN','ADDENDUM','AMENDMENT','SURAT'];
BEGIN
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_co FROM companies;
  IF v_co IS NULL THEN RAISE NOTICE 'No companies'; RETURN; END IF;
  FOR i IN 1..50 LOOP
    v_co_id:=v_co[((i-1)%array_length(v_co,1))+1];
    v_cat:=v_cats[((i-1)%5)+1]::"VendorContractCategory";
    v_status:=v_sts[((i-1)%5)+1]::"VendorContractStatus";
    v_dt:=v_dts[((i-1)%6)+1]::"VendorDocType";
    v_created:='2022-01-01'::DATE+((i-1)*14);
    v_needs:=(i%3)!=0;
    IF v_needs THEN
      v_start:=v_created;
      v_end:=CASE v_status
        WHEN 'AKTIF'::"VendorContractStatus" THEN v_created+INTERVAL'2 years'
        WHEN 'AKAN_BERAKHIR'::"VendorContractStatus" THEN CURRENT_DATE+((i%20)+5)
        ELSE v_created+INTERVAL'1 year' END;
    ELSE v_start:=NULL; v_end:=NULL; v_status:='TIDAK_AKTIF'::"VendorContractStatus";
    END IF;
    INSERT INTO vendor_contracts(category,"companyId","documentName","documentNumber","documentType",
      "createdDate","needsRenewal","startDate","endDate",status,location,"createdAt","updatedAt")
    VALUES(v_cat,v_co_id,
      CASE v_dt
        WHEN 'DOKUMEN_KONTRAK'::"VendorDocType"    THEN 'Kontrak '||CASE v_cat WHEN 'CUSTOMER'::"VendorContractCategory" THEN 'Layanan' ELSE 'Pengadaan' END||' #'||i
        WHEN 'DOKUMEN_PERJANJIAN'::"VendorDocType" THEN 'Perjanjian Kerjasama #'||i
        WHEN 'SURAT_PENAWARAN'::"VendorDocType"    THEN 'Penawaran Harga #'||i
        WHEN 'ADDENDUM'::"VendorDocType"           THEN 'Addendum Kontrak #'||i
        WHEN 'AMENDMENT'::"VendorDocType"          THEN 'Amendment Perjanjian #'||i
        ELSE 'Surat Resmi #'||i END,
      'VKT/DUMMY/'||LPAD(i::TEXT,3,'0'),v_dt,v_created,v_needs,v_start,v_end,v_status,
      CASE ((i-1)%3) WHEN 0 THEN 'Jakarta Utara' WHEN 1 THEN 'Cikarang' ELSE 'Tanjung Priok' END,
      NOW(),NOW());
  END LOOP;
END $$;

-- ── 9. LEGAL KOPERASI (50 dummy) ─────────────────────────────────────────────
DO $$
DECLARE
  i INT; v_cat "LegalKoperasiCategory"; v_status "LegalKoperasiStatus";
  v_needs BOOLEAN; v_doc DATE; v_start DATE; v_end DATE;
  v_cats TEXT[] := ARRAY['IZIN','SERTIFIKAT','KEBIJAKAN','DOKUMEN_INTERNAL','DOKUMEN_B3','LAIN_LAIN'];
  v_sts TEXT[]  := ARRAY['AKTIF','AKTIF','AKAN_BERAKHIR','EXPIRED','TIDAK_AKTIF'];
  v_pubs TEXT[] := ARRAY[
    'Kementerian Koperasi dan UKM','Dinas Koperasi Provinsi DKI','BPOM RI',
    'Kementerian Lingkungan Hidup','BNSP','ISO Certification Body',
    'Dinas Perindustrian','Kementerian Ketenagakerjaan','BSN','Lembaga Sertifikasi Int.'
  ];
BEGIN
  FOR i IN 1..50 LOOP
    v_cat:=v_cats[((i-1)%6)+1]::"LegalKoperasiCategory";
    v_status:=v_sts[((i-1)%5)+1]::"LegalKoperasiStatus";
    v_needs:=v_status!='TIDAK_AKTIF'::"LegalKoperasiStatus";
    v_doc:='2020-01-01'::DATE+((i-1)*30);
    IF v_needs THEN
      v_start:=v_doc;
      v_end:=CASE v_status
        WHEN 'AKTIF'::"LegalKoperasiStatus"         THEN CURRENT_DATE+((i*15)+90)
        WHEN 'AKAN_BERAKHIR'::"LegalKoperasiStatus" THEN CURRENT_DATE+((i%20)+5)
        ELSE v_doc+INTERVAL'2 years' END;
    ELSE v_start:=NULL; v_end:=NULL;
    END IF;
    INSERT INTO legal_koperasi(category,"documentName","documentNumber",publisher,"documentDate",
      "needsRenewal","startDate","endDate",status,location,notes,"createdAt","updatedAt")
    VALUES(v_cat,
      CASE v_cat
        WHEN 'IZIN'::"LegalKoperasiCategory"             THEN 'Izin Usaha Simpan Pinjam #'||i
        WHEN 'SERTIFIKAT'::"LegalKoperasiCategory"       THEN 'Sertifikat Mutu ISO '||(9000+(i%10))||' #'||i
        WHEN 'KEBIJAKAN'::"LegalKoperasiCategory"        THEN 'Kebijakan Manajemen Mutu Rev-'||i
        WHEN 'DOKUMEN_INTERNAL'::"LegalKoperasiCategory" THEN 'SOP Operasional #'||i
        WHEN 'DOKUMEN_B3'::"LegalKoperasiCategory"       THEN 'Dokumen Pengelolaan B3 #'||i
        ELSE 'Dokumen Legal Lainnya #'||i END,
      'LK/DUMMY/'||LPAD(i::TEXT,3,'0'),
      v_pubs[((i-1)%10)+1],v_doc,v_needs,v_start,v_end,v_status,
      CASE ((i-1)%3) WHEN 0 THEN 'Jakarta Pusat' WHEN 1 THEN 'Cikarang' ELSE 'Tanjung Priok' END,
      CASE (i%4) WHEN 0 THEN 'Dokumen aktif dan terverifikasi' WHEN 1 THEN 'Perlu perpanjangan segera' ELSE NULL END,
      NOW(),NOW());
  END LOOP;
END $$;

-- ── 10. AKTE DOKUMEN (50 dummy) ──────────────────────────────────────────────
DO $$
DECLARE
  i INT; v_tgl DATE;
  v_notaris TEXT[] := ARRAY[
    'H. Ahmad Syahputra, S.H., M.Kn.','Dra. Sri Wahyuni, S.H.',
    'Ir. Bambang Widodo, M.H.','Rr. Endang Setiawati, S.H., Sp.N.',
    'Dr. Hendra Kusuma, S.H., M.Kn.','Nelly Andriani, S.H.',
    'Drs. Supriadi, S.H., M.Hum.','Fitri Handayani, S.H., M.Kn.',
    'Agus Santoso, S.H.','Yuni Ariastuti, S.H., M.H.'
  ];
  v_judul TEXT[] := ARRAY[
    'Akte Pendirian Koperasi','Akte Perubahan Anggaran Dasar',
    'Akte Pembubaran Unit Usaha','Akte Pengangkatan Pengurus',
    'Akte Penggabungan Koperasi','Akte Pemisahan Unit Bisnis',
    'Akte Pernyataan Keputusan Rapat','Akte Perjanjian Kerjasama',
    'Akte Hibah Aset Koperasi','Akte Notarial Lainnya'
  ];
BEGIN
  FOR i IN 1..50 LOOP
    v_tgl:='2010-01-01'::DATE+((i-1)*60);
    INSERT INTO akte_dokumen(tanggal,notaris,nomor_akte,judul_akte,nomor_sk,tanggal_sk,keterangan,created_at,updated_at)
    VALUES(v_tgl,v_notaris[((i-1)%10)+1],
      LPAD(i::TEXT,3,'0')||'/AKT/'||EXTRACT(YEAR FROM v_tgl)::TEXT,
      v_judul[((i-1)%10)+1]||' Tahun '||EXTRACT(YEAR FROM v_tgl)::TEXT,
      CASE (i%3) WHEN 0 THEN 'SK/KOP/'||LPAD(i::TEXT,3,'0')||'/'||EXTRACT(YEAR FROM v_tgl)::TEXT ELSE NULL END,
      CASE (i%3) WHEN 0 THEN v_tgl+30 ELSE NULL END,
      CASE (i%4) WHEN 0 THEN 'Terdaftar di Kemenkumham' WHEN 1 THEN 'Dalam proses legalisasi' WHEN 2 THEN 'Arsip tersimpan' ELSE NULL END,
      NOW(),NOW());
  END LOOP;
END $$;

COMMIT;

-- ── VERIFIKASI ───────────────────────────────────────────────────────────────
SELECT urut,tabel,jumlah FROM (
  SELECT 1 AS urut,'employees dummy'              AS tabel,COUNT(*)::INT AS jumlah FROM employees WHERE "employeeNo" LIKE 'EMP0%' AND "employeeNo"!='EMP001'
  UNION ALL SELECT 2,'companies',                        COUNT(*)::INT FROM companies
  UNION ALL SELECT 3,'document_types CERTIFICATION',     COUNT(*)::INT FROM document_types WHERE category='CERTIFICATION'
  UNION ALL SELECT 4,'contracts dummy',                  COUNT(*)::INT FROM contracts WHERE "contractNo" LIKE 'KTR/DUMMY/%'
  UNION ALL SELECT 5,'dok karyawan PERSONAL dummy',      COUNT(*)::INT FROM employee_documents WHERE "documentNumber" LIKE 'DKDUM%'
  UNION ALL SELECT 6,'surat peringatan dummy',           COUNT(*)::INT FROM warning_letters WHERE "letterNumber" LIKE 'SP/DUMMY/%'
  UNION ALL SELECT 7,'sertifikasi & ijin dummy',         COUNT(*)::INT FROM employee_documents WHERE "documentNumber" LIKE 'SRTDUM%'
  UNION ALL SELECT 8,'vendor contracts dummy',           COUNT(*)::INT FROM vendor_contracts WHERE "documentNumber" LIKE 'VKT/DUMMY/%'
  UNION ALL SELECT 9,'legal koperasi dummy',             COUNT(*)::INT FROM legal_koperasi WHERE "documentNumber" LIKE 'LK/DUMMY/%'
  UNION ALL SELECT 10,'akte dokumen dummy',              COUNT(*)::INT FROM akte_dokumen WHERE nomor_akte LIKE '%/AKT/%'
) t ORDER BY urut;