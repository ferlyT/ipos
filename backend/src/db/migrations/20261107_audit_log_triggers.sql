-- ============================================================================
-- MIGRASI DATABASE: SISTEM AUDIT LOG UPDATE & DELETE (PENJUALAN & PEMBELIAN)
-- Kompatibel Penuh dengan PostgreSQL 8.4.6+ (iPos 4.0 Native & Multi-Schema)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HELPER ESCAPE STRING UNTUK FORMAT JSON (PostgreSQL 8.4 Compatible)
-- ----------------------------------------------------------------------------
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
-- 2. TRIGGER PENJUALAN HEADER (tbl_ikhd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_ikhd()
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
      '"kodesales":' || fn_audit_escape_json(OLD.kodesales) || ',' ||
      '"subtotal":' || coalesce(OLD.subtotal::text, '0') || ',' ||
      '"potnomfaktur":' || coalesce(OLD.potnomfaktur::text, '0') || ',' ||
      '"pajak":' || coalesce(OLD.pajak::text, '0') || ',' ||
      '"biayalain":' || coalesce(OLD.biayalain::text, '0') || ',' ||
      '"totalakhir":' || coalesce(OLD.totalakhir::text, '0') || ',' ||
      '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
      '"jmltunai":' || coalesce(OLD.jmltunai::text, '0') || ',' ||
      '"jmlkredit":' || coalesce(OLD.jmlkredit::text, '0') || ',' ||
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
      TG_TABLE_SCHEMA, 'tbl_ikhd', 'DELETE', 'PENJUALAN', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalakhir, v_user_app, inet_client_addr()::text,
      'FAKTUR PENJUALAN DIHAPUS. No: ' || OLD.notransaksi || ', Total: ' || coalesce(OLD.totalakhir::text, '0') || ', Pelanggan: ' || coalesce(OLD.kodesupel, '-'),
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
    IF OLD.kodesales IS DISTINCT FROM NEW.kodesales THEN
      v_diff := v_diff || 'sales: ' || coalesce(OLD.kodesales, 'NULL') || ' -> ' || coalesce(NEW.kodesales, 'NULL') || '; ';
    END IF;
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal THEN
      v_diff := v_diff || 'subtotal: ' || coalesce(OLD.subtotal::text, '0') || ' -> ' || coalesce(NEW.subtotal::text, '0') || '; ';
    END IF;
    IF OLD.potnomfaktur IS DISTINCT FROM NEW.potnomfaktur THEN
      v_diff := v_diff || 'potongan: ' || coalesce(OLD.potnomfaktur::text, '0') || ' -> ' || coalesce(NEW.potnomfaktur::text, '0') || '; ';
    END IF;
    IF OLD.pajak IS DISTINCT FROM NEW.pajak THEN
      v_diff := v_diff || 'pajak: ' || coalesce(OLD.pajak::text, '0') || ' -> ' || coalesce(NEW.pajak::text, '0') || '; ';
    END IF;
    IF OLD.biayalain IS DISTINCT FROM NEW.biayalain THEN
      v_diff := v_diff || 'biayalain: ' || coalesce(OLD.biayalain::text, '0') || ' -> ' || coalesce(NEW.biayalain::text, '0') || '; ';
    END IF;
    IF OLD.totalakhir IS DISTINCT FROM NEW.totalakhir THEN
      v_diff := v_diff || 'totalakhir: ' || coalesce(OLD.totalakhir::text, '0') || ' -> ' || coalesce(NEW.totalakhir::text, '0') || '; ';
    END IF;
    IF OLD.carabayar IS DISTINCT FROM NEW.carabayar THEN
      v_diff := v_diff || 'carabayar: ' || coalesce(OLD.carabayar, 'NULL') || ' -> ' || coalesce(NEW.carabayar, 'NULL') || '; ';
    END IF;
    IF OLD.jmltunai IS DISTINCT FROM NEW.jmltunai THEN
      v_diff := v_diff || 'tunai: ' || coalesce(OLD.jmltunai::text, '0') || ' -> ' || coalesce(NEW.jmltunai::text, '0') || '; ';
    END IF;
    IF OLD.jmlkredit IS DISTINCT FROM NEW.jmlkredit THEN
      v_diff := v_diff || 'kredit: ' || coalesce(OLD.jmlkredit::text, '0') || ' -> ' || coalesce(NEW.jmlkredit::text, '0') || '; ';
    END IF;
    IF OLD.krd_jml_byr IS DISTINCT FROM NEW.krd_jml_byr THEN
      v_diff := v_diff || 'jml_dibayar: ' || coalesce(OLD.krd_jml_byr::text, '0') || ' -> ' || coalesce(NEW.krd_jml_byr::text, '0') || '; ';
    END IF;
    IF OLD.keterangan IS DISTINCT FROM NEW.keterangan THEN
      v_diff := v_diff || 'keterangan diubah; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
        '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"subtotal":' || coalesce(OLD.subtotal::text, '0') || ',' ||
        '"potnomfaktur":' || coalesce(OLD.potnomfaktur::text, '0') || ',' ||
        '"pajak":' || coalesce(OLD.pajak::text, '0') || ',' ||
        '"biayalain":' || coalesce(OLD.biayalain::text, '0') || ',' ||
        '"totalakhir":' || coalesce(OLD.totalakhir::text, '0') || ',' ||
        '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
        '"jmltunai":' || coalesce(OLD.jmltunai::text, '0') || ',' ||
        '"jmlkredit":' || coalesce(OLD.jmlkredit::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(OLD.user2) ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodekantor":' || fn_audit_escape_json(NEW.kodekantor) || ',' ||
        '"tanggal":' || fn_audit_escape_json(NEW.tanggal::text) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"subtotal":' || coalesce(NEW.subtotal::text, '0') || ',' ||
        '"potnomfaktur":' || coalesce(NEW.potnomfaktur::text, '0') || ',' ||
        '"pajak":' || coalesce(NEW.pajak::text, '0') || ',' ||
        '"biayalain":' || coalesce(NEW.biayalain::text, '0') || ',' ||
        '"totalakhir":' || coalesce(NEW.totalakhir::text, '0') || ',' ||
        '"carabayar":' || fn_audit_escape_json(NEW.carabayar) || ',' ||
        '"jmltunai":' || coalesce(NEW.jmltunai::text, '0') || ',' ||
        '"jmlkredit":' || coalesce(NEW.jmlkredit::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(NEW.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(NEW.user2) ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_ikhd', 'UPDATE', 'PENJUALAN', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalakhir, v_user_app, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Pasang Trigger tbl_ikhd
DROP TRIGGER IF EXISTS trg_audit_tbl_ikhd ON tbl_ikhd;
CREATE TRIGGER trg_audit_tbl_ikhd
AFTER UPDATE OR DELETE ON tbl_ikhd
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_ikhd();


-- ----------------------------------------------------------------------------
-- 3. TRIGGER PENJUALAN DETAIL (tbl_ikdt)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_ikdt()
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
      '"kodeitem":' || fn_audit_escape_json(OLD.kodeitem) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"satuan":' || fn_audit_escape_json(OLD.satuan) || ',' ||
      '"harga":' || coalesce(OLD.harga::text, '0') || ',' ||
      '"potongan":' || coalesce(OLD.potongan::text, '0') || ',' ||
      '"total":' || coalesce(OLD.total::text, '0') ||
    '}';

    -- Ambil user dari header pada skema yang sama
    BEGIN
      EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_ikhd WHERE notransaksi = $1 LIMIT 1'
      INTO v_user_app
      USING OLD.notransaksi;
    EXCEPTION WHEN OTHERS THEN
      v_user_app := 'SYSTEM';
    END;

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_ikdt', 'DELETE', 'PENJUALAN', OLD.notransaksi, OLD.iddetail, OLD.kodeitem,
      NULL, NULL, OLD.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
      'ITEM PENJUALAN DIHAPUS: ' || coalesce(OLD.kodeitem, '-') || ' (' || coalesce(OLD.jumlah::text, '0') || ' ' || coalesce(OLD.satuan, '') || ') @ ' || coalesce(OLD.harga::text, '0') || ', Subtotal: ' || coalesce(OLD.total::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.kodeitem IS DISTINCT FROM NEW.kodeitem THEN
      v_diff := v_diff || 'kodeitem: ' || coalesce(OLD.kodeitem, 'NULL') || ' -> ' || coalesce(NEW.kodeitem, 'NULL') || '; ';
    END IF;
    IF OLD.jumlah IS DISTINCT FROM NEW.jumlah THEN
      v_diff := v_diff || 'jumlah: ' || coalesce(OLD.jumlah::text, '0') || ' -> ' || coalesce(NEW.jumlah::text, '0') || '; ';
    END IF;
    IF OLD.satuan IS DISTINCT FROM NEW.satuan THEN
      v_diff := v_diff || 'satuan: ' || coalesce(OLD.satuan, 'NULL') || ' -> ' || coalesce(NEW.satuan, 'NULL') || '; ';
    END IF;
    IF OLD.harga IS DISTINCT FROM NEW.harga THEN
      v_diff := v_diff || 'harga: ' || coalesce(OLD.harga::text, '0') || ' -> ' || coalesce(NEW.harga::text, '0') || '; ';
    END IF;
    IF OLD.potongan IS DISTINCT FROM NEW.potongan THEN
      v_diff := v_diff || 'potongan: ' || coalesce(OLD.potongan::text, '0') || ' -> ' || coalesce(NEW.potongan::text, '0') || '; ';
    END IF;
    IF OLD.total IS DISTINCT FROM NEW.total THEN
      v_diff := v_diff || 'total: ' || coalesce(OLD.total::text, '0') || ' -> ' || coalesce(NEW.total::text, '0') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
        '"nobaris":' || coalesce(OLD.nobaris::text, '0') || ',' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodeitem":' || fn_audit_escape_json(OLD.kodeitem) || ',' ||
        '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
        '"satuan":' || fn_audit_escape_json(OLD.satuan) || ',' ||
        '"harga":' || coalesce(OLD.harga::text, '0') || ',' ||
        '"potongan":' || coalesce(OLD.potongan::text, '0') || ',' ||
        '"total":' || coalesce(OLD.total::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(NEW.iddetail) || ',' ||
        '"nobaris":' || coalesce(NEW.nobaris::text, '0') || ',' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodeitem":' || fn_audit_escape_json(NEW.kodeitem) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') || ',' ||
        '"satuan":' || fn_audit_escape_json(NEW.satuan) || ',' ||
        '"harga":' || coalesce(NEW.harga::text, '0') || ',' ||
        '"potongan":' || coalesce(NEW.potongan::text, '0') || ',' ||
        '"total":' || coalesce(NEW.total::text, '0') ||
      '}';

      BEGIN
        EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_ikhd WHERE notransaksi = $1 LIMIT 1'
        INTO v_user_app
        USING NEW.notransaksi;
      EXCEPTION WHEN OTHERS THEN
        v_user_app := 'SYSTEM';
      END;

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_ikdt', 'UPDATE', 'PENJUALAN', NEW.notransaksi, NEW.iddetail, NEW.kodeitem,
        NULL, NULL, NEW.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Pasang Trigger tbl_ikdt
DROP TRIGGER IF EXISTS trg_audit_tbl_ikdt ON tbl_ikdt;
CREATE TRIGGER trg_audit_tbl_ikdt
AFTER UPDATE OR DELETE ON tbl_ikdt
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_ikdt();


-- ----------------------------------------------------------------------------
-- 4. TRIGGER PEMBELIAN HEADER (tbl_imhd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_imhd()
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
      '"subtotal":' || coalesce(OLD.subtotal::text, '0') || ',' ||
      '"potnomfaktur":' || coalesce(OLD.potnomfaktur::text, '0') || ',' ||
      '"pajak":' || coalesce(OLD.pajak::text, '0') || ',' ||
      '"biayalain":' || coalesce(OLD.biayalain::text, '0') || ',' ||
      '"totalakhir":' || coalesce(OLD.totalakhir::text, '0') || ',' ||
      '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
      '"jmltunai":' || coalesce(OLD.jmltunai::text, '0') || ',' ||
      '"jmlkredit":' || coalesce(OLD.jmlkredit::text, '0') || ',' ||
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
      TG_TABLE_SCHEMA, 'tbl_imhd', 'DELETE', 'PEMBELIAN', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalakhir, v_user_app, inet_client_addr()::text,
      'FAKTUR PEMBELIAN DIHAPUS. No: ' || OLD.notransaksi || ', Total: ' || coalesce(OLD.totalakhir::text, '0') || ', Supplier: ' || coalesce(OLD.kodesupel, '-'),
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
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal THEN
      v_diff := v_diff || 'subtotal: ' || coalesce(OLD.subtotal::text, '0') || ' -> ' || coalesce(NEW.subtotal::text, '0') || '; ';
    END IF;
    IF OLD.potnomfaktur IS DISTINCT FROM NEW.potnomfaktur THEN
      v_diff := v_diff || 'potongan: ' || coalesce(OLD.potnomfaktur::text, '0') || ' -> ' || coalesce(NEW.potnomfaktur::text, '0') || '; ';
    END IF;
    IF OLD.pajak IS DISTINCT FROM NEW.pajak THEN
      v_diff := v_diff || 'pajak: ' || coalesce(OLD.pajak::text, '0') || ' -> ' || coalesce(NEW.pajak::text, '0') || '; ';
    END IF;
    IF OLD.biayalain IS DISTINCT FROM NEW.biayalain THEN
      v_diff := v_diff || 'biayalain: ' || coalesce(OLD.biayalain::text, '0') || ' -> ' || coalesce(NEW.biayalain::text, '0') || '; ';
    END IF;
    IF OLD.totalakhir IS DISTINCT FROM NEW.totalakhir THEN
      v_diff := v_diff || 'totalakhir: ' || coalesce(OLD.totalakhir::text, '0') || ' -> ' || coalesce(NEW.totalakhir::text, '0') || '; ';
    END IF;
    IF OLD.carabayar IS DISTINCT FROM NEW.carabayar THEN
      v_diff := v_diff || 'carabayar: ' || coalesce(OLD.carabayar, 'NULL') || ' -> ' || coalesce(NEW.carabayar, 'NULL') || '; ';
    END IF;
    IF OLD.jmltunai IS DISTINCT FROM NEW.jmltunai THEN
      v_diff := v_diff || 'tunai: ' || coalesce(OLD.jmltunai::text, '0') || ' -> ' || coalesce(NEW.jmltunai::text, '0') || '; ';
    END IF;
    IF OLD.jmlkredit IS DISTINCT FROM NEW.jmlkredit THEN
      v_diff := v_diff || 'kredit: ' || coalesce(OLD.jmlkredit::text, '0') || ' -> ' || coalesce(NEW.jmlkredit::text, '0') || '; ';
    END IF;
    IF OLD.krd_jml_byr IS DISTINCT FROM NEW.krd_jml_byr THEN
      v_diff := v_diff || 'jml_dibayar: ' || coalesce(OLD.krd_jml_byr::text, '0') || ' -> ' || coalesce(NEW.krd_jml_byr::text, '0') || '; ';
    END IF;
    IF OLD.keterangan IS DISTINCT FROM NEW.keterangan THEN
      v_diff := v_diff || 'keterangan diubah; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
        '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"subtotal":' || coalesce(OLD.subtotal::text, '0') || ',' ||
        '"potnomfaktur":' || coalesce(OLD.potnomfaktur::text, '0') || ',' ||
        '"pajak":' || coalesce(OLD.pajak::text, '0') || ',' ||
        '"biayalain":' || coalesce(OLD.biayalain::text, '0') || ',' ||
        '"totalakhir":' || coalesce(OLD.totalakhir::text, '0') || ',' ||
        '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
        '"jmltunai":' || coalesce(OLD.jmltunai::text, '0') || ',' ||
        '"jmlkredit":' || coalesce(OLD.jmlkredit::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(OLD.user2) ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodekantor":' || fn_audit_escape_json(NEW.kodekantor) || ',' ||
        '"tanggal":' || fn_audit_escape_json(NEW.tanggal::text) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"subtotal":' || coalesce(NEW.subtotal::text, '0') || ',' ||
        '"potnomfaktur":' || coalesce(NEW.potnomfaktur::text, '0') || ',' ||
        '"pajak":' || coalesce(NEW.pajak::text, '0') || ',' ||
        '"biayalain":' || coalesce(NEW.biayalain::text, '0') || ',' ||
        '"totalakhir":' || coalesce(NEW.totalakhir::text, '0') || ',' ||
        '"carabayar":' || fn_audit_escape_json(NEW.carabayar) || ',' ||
        '"jmltunai":' || coalesce(NEW.jmltunai::text, '0') || ',' ||
        '"jmlkredit":' || coalesce(NEW.jmlkredit::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(NEW.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(NEW.user2) ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_imhd', 'UPDATE', 'PEMBELIAN', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalakhir, v_user_app, inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Pasang Trigger tbl_imhd
DROP TRIGGER IF EXISTS trg_audit_tbl_imhd ON tbl_imhd;
CREATE TRIGGER trg_audit_tbl_imhd
AFTER UPDATE OR DELETE ON tbl_imhd
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_imhd();


-- ----------------------------------------------------------------------------
-- 5. TRIGGER PEMBELIAN DETAIL (tbl_imdt)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_imdt()
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
      '"kodeitem":' || fn_audit_escape_json(OLD.kodeitem) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"satuan":' || fn_audit_escape_json(OLD.satuan) || ',' ||
      '"harga":' || coalesce(OLD.harga::text, '0') || ',' ||
      '"potongan":' || coalesce(OLD.potongan::text, '0') || ',' ||
      '"total":' || coalesce(OLD.total::text, '0') ||
    '}';

    BEGIN
      EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_imhd WHERE notransaksi = $1 LIMIT 1'
      INTO v_user_app
      USING OLD.notransaksi;
    EXCEPTION WHEN OTHERS THEN
      v_user_app := 'SYSTEM';
    END;

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_imdt', 'DELETE', 'PEMBELIAN', OLD.notransaksi, OLD.iddetail, OLD.kodeitem,
      NULL, NULL, OLD.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
      'ITEM PEMBELIAN DIHAPUS: ' || coalesce(OLD.kodeitem, '-') || ' (' || coalesce(OLD.jumlah::text, '0') || ' ' || coalesce(OLD.satuan, '') || ') @ ' || coalesce(OLD.harga::text, '0') || ', Subtotal: ' || coalesce(OLD.total::text, '0'),
      v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.kodeitem IS DISTINCT FROM NEW.kodeitem THEN
      v_diff := v_diff || 'kodeitem: ' || coalesce(OLD.kodeitem, 'NULL') || ' -> ' || coalesce(NEW.kodeitem, 'NULL') || '; ';
    END IF;
    IF OLD.jumlah IS DISTINCT FROM NEW.jumlah THEN
      v_diff := v_diff || 'jumlah: ' || coalesce(OLD.jumlah::text, '0') || ' -> ' || coalesce(NEW.jumlah::text, '0') || '; ';
    END IF;
    IF OLD.satuan IS DISTINCT FROM NEW.satuan THEN
      v_diff := v_diff || 'satuan: ' || coalesce(OLD.satuan, 'NULL') || ' -> ' || coalesce(NEW.satuan, 'NULL') || '; ';
    END IF;
    IF OLD.harga IS DISTINCT FROM NEW.harga THEN
      v_diff := v_diff || 'harga: ' || coalesce(OLD.harga::text, '0') || ' -> ' || coalesce(NEW.harga::text, '0') || '; ';
    END IF;
    IF OLD.potongan IS DISTINCT FROM NEW.potongan THEN
      v_diff := v_diff || 'potongan: ' || coalesce(OLD.potongan::text, '0') || ' -> ' || coalesce(NEW.potongan::text, '0') || '; ';
    END IF;
    IF OLD.total IS DISTINCT FROM NEW.total THEN
      v_diff := v_diff || 'total: ' || coalesce(OLD.total::text, '0') || ' -> ' || coalesce(NEW.total::text, '0') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
        '"nobaris":' || coalesce(OLD.nobaris::text, '0') || ',' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodeitem":' || fn_audit_escape_json(OLD.kodeitem) || ',' ||
        '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
        '"satuan":' || fn_audit_escape_json(OLD.satuan) || ',' ||
        '"harga":' || coalesce(OLD.harga::text, '0') || ',' ||
        '"potongan":' || coalesce(OLD.potongan::text, '0') || ',' ||
        '"total":' || coalesce(OLD.total::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(NEW.iddetail) || ',' ||
        '"nobaris":' || coalesce(NEW.nobaris::text, '0') || ',' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodeitem":' || fn_audit_escape_json(NEW.kodeitem) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') || ',' ||
        '"satuan":' || fn_audit_escape_json(NEW.satuan) || ',' ||
        '"harga":' || coalesce(NEW.harga::text, '0') || ',' ||
        '"potongan":' || coalesce(NEW.potongan::text, '0') || ',' ||
        '"total":' || coalesce(NEW.total::text, '0') ||
      '}';

      BEGIN
        EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_imhd WHERE notransaksi = $1 LIMIT 1'
        INTO v_user_app
        USING NEW.notransaksi;
      EXCEPTION WHEN OTHERS THEN
        v_user_app := 'SYSTEM';
      END;

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_imdt', 'UPDATE', 'PEMBELIAN', NEW.notransaksi, NEW.iddetail, NEW.kodeitem,
        NULL, NULL, NEW.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
        v_diff, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Pasang Trigger tbl_imdt
DROP TRIGGER IF EXISTS trg_audit_tbl_imdt ON tbl_imdt;
CREATE TRIGGER trg_audit_tbl_imdt
AFTER UPDATE OR DELETE ON tbl_imdt
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_imdt();
