-- ============================================================================
-- MIGRASI DATABASE: SISTEM AUDIT LOG MODUL AKUNTANSI & KAS/BANK
-- Kompatibel Penuh dengan PostgreSQL 8.4.6+ (iPos 4.0 Native & Multi-Schema)
-- Mencakup: tbl_acckashd, tbl_acckasdt, tbl_accjurnal, tbl_byrhutanghd, tbl_byrpiutanghd, tbl_accdeposithd
-- ============================================================================

-- Helper escape JSON jika belum ada
CREATE OR REPLACE FUNCTION fn_audit_escape_json(val text) RETURNS text AS $$
DECLARE
  clean text;
  bs text;
  dq text;
BEGIN
  IF val IS NULL THEN
    RETURN 'null';
  END IF;
  bs := chr(92);
  dq := chr(34);
  clean := replace(val, bs, bs || bs);
  clean := replace(clean, dq, bs || dq);
  clean := replace(clean, chr(10), bs || 'n');
  clean := replace(clean, chr(13), bs || 'r');
  RETURN dq || clean || dq;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- 1. TRIGGER KAS & BANK HEADER (tbl_acckashd) - Kas Masuk, Kas Keluar, Transfer
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_acckashd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
      '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
      '"kodeaccto":' || fn_audit_escape_json(OLD.kodeaccto) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"subtotal":' || coalesce(OLD.subtotal::text, '0') || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) || ',' ||
      '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
      '"user2":' || fn_audit_escape_json(OLD.user2) ||
    '}';

    v_user_app := coalesce(OLD.user2, OLD.user1, 'SYSTEM');

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_acckashd', 'DELETE', 'KAS_BANK', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, NULL, OLD.jumlah, v_user_app, inet_client_addr()::text,
      'TRANSAKSI KAS/BANK DIHAPUS. No: ' || OLD.notransaksi || ', Tipe: ' || coalesce(OLD.tipe, '-') || ', Akun: ' || coalesce(OLD.kodeacc, '-') || ', Jumlah: ' || coalesce(OLD.jumlah::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodeacc IS DISTINCT FROM NEW.kodeacc THEN
      v_diff := v_diff || 'kodeacc: ' || coalesce(OLD.kodeacc, 'NULL') || ' -> ' || coalesce(NEW.kodeacc, 'NULL') || '; ';
    END IF;
    IF OLD.kodeaccto IS DISTINCT FROM NEW.kodeaccto THEN
      v_diff := v_diff || 'kodeaccto: ' || coalesce(OLD.kodeaccto, 'NULL') || ' -> ' || coalesce(NEW.kodeaccto, 'NULL') || '; ';
    END IF;
    IF OLD.jumlah IS DISTINCT FROM NEW.jumlah THEN
      v_diff := v_diff || 'jumlah: ' || coalesce(OLD.jumlah::text, '0') || ' -> ' || coalesce(NEW.jumlah::text, '0') || '; ';
    END IF;
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal THEN
      v_diff := v_diff || 'subtotal: ' || coalesce(OLD.subtotal::text, '0') || ' -> ' || coalesce(NEW.subtotal::text, '0') || '; ';
    END IF;
    IF OLD.keterangan IS DISTINCT FROM NEW.keterangan THEN
      v_diff := v_diff || 'keterangan diubah; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
        '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
        '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
        '"kodeaccto":' || fn_audit_escape_json(OLD.kodeaccto) || ',' ||
        '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(OLD.user2) ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodekantor":' || fn_audit_escape_json(NEW.kodekantor) || ',' ||
        '"tanggal":' || fn_audit_escape_json(NEW.tanggal::text) || ',' ||
        '"tipe":' || fn_audit_escape_json(NEW.tipe) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(NEW.kodeacc) || ',' ||
        '"kodeaccto":' || fn_audit_escape_json(NEW.kodeaccto) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(NEW.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(NEW.user2) ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_acckashd', 'UPDATE', 'KAS_BANK', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NULL, NEW.jumlah, v_user_app, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_tbl_acckashd ON tbl_acckashd;
CREATE TRIGGER trg_audit_tbl_acckashd
AFTER UPDATE OR DELETE ON tbl_acckashd
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_acckashd();

-- ----------------------------------------------------------------------------
-- 2. TRIGGER KAS & BANK DETAIL (tbl_acckasdt)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_acckasdt()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := '{' ||
      '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
      '"nobaris":' || coalesce(OLD.nobaris::text, '0') || ',' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') ||
    '}';

    SELECT coalesce(user2, user1, 'SYSTEM') INTO v_user_app
    FROM tbl_acckashd WHERE notransaksi = OLD.notransaksi LIMIT 1;
    IF v_user_app IS NULL THEN v_user_app := 'SYSTEM'; END IF;

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_acckasdt', 'DELETE', 'KAS_BANK', OLD.notransaksi, OLD.iddetail, NULL,
      NULL, NULL, OLD.jumlah, v_user_app, inet_client_addr()::text,
      'RINCIAN ITEM KAS DIHAPUS. Baris: ' || coalesce(OLD.nobaris::text, '0') || ', Akun: ' || coalesce(OLD.kodeacc, '-') || ', Jumlah: ' || coalesce(OLD.jumlah::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.kodeacc IS DISTINCT FROM NEW.kodeacc THEN
      v_diff := v_diff || 'kodeacc: ' || coalesce(OLD.kodeacc, 'NULL') || ' -> ' || coalesce(NEW.kodeacc, 'NULL') || '; ';
    END IF;
    IF OLD.jumlah IS DISTINCT FROM NEW.jumlah THEN
      v_diff := v_diff || 'jumlah: ' || coalesce(OLD.jumlah::text, '0') || ' -> ' || coalesce(NEW.jumlah::text, '0') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
        '"nobaris":' || coalesce(OLD.nobaris::text, '0') || ',' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
        '"jumlah":' || coalesce(OLD.jumlah::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(NEW.iddetail) || ',' ||
        '"nobaris":' || coalesce(NEW.nobaris::text, '0') || ',' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(NEW.kodeacc) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') ||
      '}';

      SELECT coalesce(user2, user1, 'SYSTEM') INTO v_user_app
      FROM tbl_acckashd WHERE notransaksi = NEW.notransaksi LIMIT 1;
      IF v_user_app IS NULL THEN v_user_app := 'SYSTEM'; END IF;

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_acckasdt', 'UPDATE', 'KAS_BANK', NEW.notransaksi, NEW.iddetail, NULL,
        NULL, NULL, NEW.jumlah, v_user_app, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_tbl_acckasdt ON tbl_acckasdt;
CREATE TRIGGER trg_audit_tbl_acckasdt
AFTER UPDATE OR DELETE ON tbl_acckasdt
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_acckasdt();

-- ----------------------------------------------------------------------------
-- 3. TRIGGER JURNAL UMUM / BUKU BESAR (tbl_accjurnal)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_accjurnal()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := '{' ||
      '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
      '"nourut":' || coalesce(OLD.nourut::text, '0') || ',' ||
      '"tipeinput":' || fn_audit_escape_json(OLD.tipeinput) || ',' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
      '"posisi":' || fn_audit_escape_json(OLD.posisi) || ',' ||
      '"debet":' || coalesce(OLD.debet::text, '0') || ',' ||
      '"kredit":' || coalesce(OLD.kredit::text, '0') || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) || ',' ||
      '"kantor":' || fn_audit_escape_json(OLD.kantor) ||
    '}';

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_accjurnal', 'DELETE', 'AKUNTANSI', OLD.notransaksi, OLD.iddetail, NULL,
      OLD.kantor, NULL, coalesce(OLD.debet, OLD.kredit, OLD.jumlah, 0), CURRENT_USER, inet_client_addr()::text,
      'BARIS JURNAL DIHAPUS. No: ' || OLD.notransaksi || ', Akun: ' || coalesce(OLD.kodeacc, '-') || ', Posisi: ' || coalesce(OLD.posisi, '-') || ', Debet: ' || coalesce(OLD.debet::text, '0') || ', Kredit: ' || coalesce(OLD.kredit::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodeacc IS DISTINCT FROM NEW.kodeacc THEN
      v_diff := v_diff || 'kodeacc: ' || coalesce(OLD.kodeacc, 'NULL') || ' -> ' || coalesce(NEW.kodeacc, 'NULL') || '; ';
    END IF;
    IF OLD.posisi IS DISTINCT FROM NEW.posisi THEN
      v_diff := v_diff || 'posisi: ' || coalesce(OLD.posisi, 'NULL') || ' -> ' || coalesce(NEW.posisi, 'NULL') || '; ';
    END IF;
    IF OLD.debet IS DISTINCT FROM NEW.debet THEN
      v_diff := v_diff || 'debet: ' || coalesce(OLD.debet::text, '0') || ' -> ' || coalesce(NEW.debet::text, '0') || '; ';
    END IF;
    IF OLD.kredit IS DISTINCT FROM NEW.kredit THEN
      v_diff := v_diff || 'kredit: ' || coalesce(OLD.kredit::text, '0') || ' -> ' || coalesce(NEW.kredit::text, '0') || '; ';
    END IF;
    IF OLD.keterangan IS DISTINCT FROM NEW.keterangan THEN
      v_diff := v_diff || 'keterangan diubah; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
        '"posisi":' || fn_audit_escape_json(OLD.posisi) || ',' ||
        '"debet":' || coalesce(OLD.debet::text, '0') || ',' ||
        '"kredit":' || coalesce(OLD.kredit::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(NEW.iddetail) || ',' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(NEW.kodeacc) || ',' ||
        '"posisi":' || fn_audit_escape_json(NEW.posisi) || ',' ||
        '"debet":' || coalesce(NEW.debet::text, '0') || ',' ||
        '"kredit":' || coalesce(NEW.kredit::text, '0') ||
      '}';

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_accjurnal', 'UPDATE', 'AKUNTANSI', NEW.notransaksi, NEW.iddetail, NULL,
        NEW.kantor, NULL, coalesce(NEW.debet, NEW.kredit, NEW.jumlah, 0), CURRENT_USER, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_tbl_accjurnal ON tbl_accjurnal;
CREATE TRIGGER trg_audit_tbl_accjurnal
AFTER UPDATE OR DELETE ON tbl_accjurnal
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_accjurnal();

-- ----------------------------------------------------------------------------
-- 4. TRIGGER PEMBAYARAN HUTANG (tbl_byrhutanghd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_byrhutanghd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') || ',' ||
      '"acc_bayar":' || fn_audit_escape_json(OLD.acc_bayar) || ',' ||
      '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
      '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
      '"user2":' || fn_audit_escape_json(OLD.user2) || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) ||
    '}';

    v_user_app := coalesce(OLD.user2, OLD.user1, 'SYSTEM');

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_byrhutanghd', 'DELETE', 'HUTANG', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalbayar, v_user_app, inet_client_addr()::text,
      'PEMBAYARAN HUTANG DIHAPUS. No: ' || OLD.notransaksi || ', Supplier: ' || coalesce(OLD.kodesupel, '-') || ', Total: ' || coalesce(OLD.totalbayar::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'supplier: ' || coalesce(OLD.kodesupel, 'NULL') || ' -> ' || coalesce(NEW.kodesupel, 'NULL') || '; ';
    END IF;
    IF OLD.totalbayar IS DISTINCT FROM NEW.totalbayar THEN
      v_diff := v_diff || 'totalbayar: ' || coalesce(OLD.totalbayar::text, '0') || ' -> ' || coalesce(NEW.totalbayar::text, '0') || '; ';
    END IF;
    IF OLD.acc_bayar IS DISTINCT FROM NEW.acc_bayar THEN
      v_diff := v_diff || 'acc_bayar: ' || coalesce(OLD.acc_bayar, 'NULL') || ' -> ' || coalesce(NEW.acc_bayar, 'NULL') || '; ';
    END IF;
    IF OLD.carabayar IS DISTINCT FROM NEW.carabayar THEN
      v_diff := v_diff || 'carabayar: ' || coalesce(OLD.carabayar, 'NULL') || ' -> ' || coalesce(NEW.carabayar, 'NULL') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') || ',' ||
        '"acc_bayar":' || fn_audit_escape_json(OLD.acc_bayar) || ',' ||
        '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(OLD.user2) ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"totalbayar":' || coalesce(NEW.totalbayar::text, '0') || ',' ||
        '"acc_bayar":' || fn_audit_escape_json(NEW.acc_bayar) || ',' ||
        '"user1":' || fn_audit_escape_json(NEW.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(NEW.user2) ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_byrhutanghd', 'UPDATE', 'HUTANG', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalbayar, v_user_app, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_tbl_byrhutanghd ON tbl_byrhutanghd;
CREATE TRIGGER trg_audit_tbl_byrhutanghd
AFTER UPDATE OR DELETE ON tbl_byrhutanghd
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_byrhutanghd();

-- ----------------------------------------------------------------------------
-- 5. TRIGGER PEMBAYARAN PIUTANG (tbl_byrpiutanghd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_byrpiutanghd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') || ',' ||
      '"acc_bayar":' || fn_audit_escape_json(OLD.acc_bayar) || ',' ||
      '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
      '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
      '"user2":' || fn_audit_escape_json(OLD.user2) || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) ||
    '}';

    v_user_app := coalesce(OLD.user2, OLD.user1, 'SYSTEM');

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_byrpiutanghd', 'DELETE', 'PIUTANG', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalbayar, v_user_app, inet_client_addr()::text,
      'PEMBAYARAN PIUTANG DIHAPUS. No: ' || OLD.notransaksi || ', Pelanggan: ' || coalesce(OLD.kodesupel, '-') || ', Total: ' || coalesce(OLD.totalbayar::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'pelanggan: ' || coalesce(OLD.kodesupel, 'NULL') || ' -> ' || coalesce(NEW.kodesupel, 'NULL') || '; ';
    END IF;
    IF OLD.totalbayar IS DISTINCT FROM NEW.totalbayar THEN
      v_diff := v_diff || 'totalbayar: ' || coalesce(OLD.totalbayar::text, '0') || ' -> ' || coalesce(NEW.totalbayar::text, '0') || '; ';
    END IF;
    IF OLD.acc_bayar IS DISTINCT FROM NEW.acc_bayar THEN
      v_diff := v_diff || 'acc_bayar: ' || coalesce(OLD.acc_bayar, 'NULL') || ' -> ' || coalesce(NEW.acc_bayar, 'NULL') || '; ';
    END IF;
    IF OLD.carabayar IS DISTINCT FROM NEW.carabayar THEN
      v_diff := v_diff || 'carabayar: ' || coalesce(OLD.carabayar, 'NULL') || ' -> ' || coalesce(NEW.carabayar, 'NULL') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') || ',' ||
        '"acc_bayar":' || fn_audit_escape_json(OLD.acc_bayar) || ',' ||
        '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(OLD.user2) ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"totalbayar":' || coalesce(NEW.totalbayar::text, '0') || ',' ||
        '"acc_bayar":' || fn_audit_escape_json(NEW.acc_bayar) || ',' ||
        '"user1":' || fn_audit_escape_json(NEW.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(NEW.user2) ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_byrpiutanghd', 'UPDATE', 'PIUTANG', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalbayar, v_user_app, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_tbl_byrpiutanghd ON tbl_byrpiutanghd;
CREATE TRIGGER trg_audit_tbl_byrpiutanghd
AFTER UPDATE OR DELETE ON tbl_byrpiutanghd
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_byrpiutanghd();

-- ----------------------------------------------------------------------------
-- 6. TRIGGER DEPOSIT (tbl_accdeposithd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_accdeposithd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
      '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
      '"user2":' || fn_audit_escape_json(OLD.user2) || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) ||
    '}';

    v_user_app := coalesce(OLD.user2, OLD.user1, 'SYSTEM');

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_accdeposithd', 'DELETE', 'DEPOSIT', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.jumlah, v_user_app, inet_client_addr()::text,
      'TRANSAKSI DEPOSIT DIHAPUS. No: ' || OLD.notransaksi || ', Supel: ' || coalesce(OLD.kodesupel, '-') || ', Jumlah: ' || coalesce(OLD.jumlah::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'supel: ' || coalesce(OLD.kodesupel, 'NULL') || ' -> ' || coalesce(NEW.kodesupel, 'NULL') || '; ';
    END IF;
    IF OLD.jumlah IS DISTINCT FROM NEW.jumlah THEN
      v_diff := v_diff || 'jumlah: ' || coalesce(OLD.jumlah::text, '0') || ' -> ' || coalesce(NEW.jumlah::text, '0') || '; ';
    END IF;
    IF OLD.kodeacc IS DISTINCT FROM NEW.kodeacc THEN
      v_diff := v_diff || 'kodeacc: ' || coalesce(OLD.kodeacc, 'NULL') || ' -> ' || coalesce(NEW.kodeacc, 'NULL') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(OLD.user2) ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(NEW.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(NEW.user2) ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_accdeposithd', 'UPDATE', 'DEPOSIT', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.jumlah, v_user_app, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_tbl_accdeposithd ON tbl_accdeposithd;
CREATE TRIGGER trg_audit_tbl_accdeposithd
AFTER UPDATE OR DELETE ON tbl_accdeposithd
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_accdeposithd();
