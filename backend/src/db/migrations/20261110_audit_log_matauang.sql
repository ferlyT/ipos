-- ============================================================================
-- MIGRASI AUDIT LOG: PENAMBAHAN KOLOM MATAUANG & UPDATE TRIGGER TRANSAKSI
-- Tanggal: 10 November 2026
-- Mendukung penyesuaian mata uang dinamis (IDR, USD, SGD, dll)
-- ============================================================================

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
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"kodesales":' || fn_audit_escape_json(OLD.kodesales) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
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
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_ikhd', 'DELETE', 'PENJUALAN', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalakhir, v_user_app, inet_client_addr()::text,
      'FAKTUR PENJUALAN DIHAPUS. No: ' || OLD.notransaksi || ', Total: ' || coalesce(OLD.totalakhir::text, '0') || ', Pelanggan: ' || coalesce(OLD.kodesupel, '-'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'pelanggan: ' || coalesce(OLD.kodesupel, 'NULL') || ' -> ' || coalesce(NEW.kodesupel, 'NULL') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
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
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
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
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
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
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_ikhd', 'UPDATE', 'PENJUALAN', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalakhir, v_user_app, inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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
  v_matauang VARCHAR(10) := 'IDR';
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN
      EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM''), coalesce(matauang, ''IDR'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_ikhd WHERE notransaksi = $1 LIMIT 1'
      INTO v_user_app, v_matauang
      USING OLD.notransaksi;
    EXCEPTION WHEN OTHERS THEN
      v_user_app := 'SYSTEM';
      v_matauang := 'IDR';
    END;
    v_matauang := coalesce(v_matauang, 'IDR');

    v_old_json := '{' ||
      '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
      '"nobaris":' || coalesce(OLD.nobaris::text, '0') || ',' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodeitem":' || fn_audit_escape_json(OLD.kodeitem) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"satuan":' || fn_audit_escape_json(OLD.satuan) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
      '"harga":' || coalesce(OLD.harga::text, '0') || ',' ||
      '"potongan":' || coalesce(OLD.potongan::text, '0') || ',' ||
      '"total":' || coalesce(OLD.total::text, '0') ||
    '}';

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_ikdt', 'DELETE', 'PENJUALAN', OLD.notransaksi, OLD.iddetail, OLD.kodeitem,
      NULL, NULL, OLD.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
      'ITEM PENJUALAN DIHAPUS: ' || coalesce(OLD.kodeitem, '-') || ' (' || coalesce(OLD.jumlah::text, '0') || ' ' || coalesce(OLD.satuan, '') || ') @ ' || coalesce(OLD.harga::text, '0') || ', Subtotal: ' || coalesce(OLD.total::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN
      EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM''), coalesce(matauang, ''IDR'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_ikhd WHERE notransaksi = $1 LIMIT 1'
      INTO v_user_app, v_matauang
      USING NEW.notransaksi;
    EXCEPTION WHEN OTHERS THEN
      v_user_app := 'SYSTEM';
      v_matauang := 'IDR';
    END;
    v_matauang := coalesce(v_matauang, 'IDR');

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
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
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
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"harga":' || coalesce(NEW.harga::text, '0') || ',' ||
        '"potongan":' || coalesce(NEW.potongan::text, '0') || ',' ||
        '"total":' || coalesce(NEW.total::text, '0') ||
      '}';

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_ikdt', 'UPDATE', 'PENJUALAN', NEW.notransaksi, NEW.iddetail, NEW.kodeitem,
        NULL, NULL, NEW.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
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
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_imhd', 'DELETE', 'PEMBELIAN', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalakhir, v_user_app, inet_client_addr()::text,
      'FAKTUR PEMBELIAN DIHAPUS. No: ' || OLD.notransaksi || ', Total: ' || coalesce(OLD.totalakhir::text, '0') || ', Supplier: ' || coalesce(OLD.kodesupel, '-'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'supplier: ' || coalesce(OLD.kodesupel, 'NULL') || ' -> ' || coalesce(NEW.kodesupel, 'NULL') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
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
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
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
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
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
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_imhd', 'UPDATE', 'PEMBELIAN', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalakhir, v_user_app, inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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
  v_matauang VARCHAR(10) := 'IDR';
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN
      EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM''), coalesce(matauang, ''IDR'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_imhd WHERE notransaksi = $1 LIMIT 1'
      INTO v_user_app, v_matauang
      USING OLD.notransaksi;
    EXCEPTION WHEN OTHERS THEN
      v_user_app := 'SYSTEM';
      v_matauang := 'IDR';
    END;
    v_matauang := coalesce(v_matauang, 'IDR');

    v_old_json := '{' ||
      '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
      '"nobaris":' || coalesce(OLD.nobaris::text, '0') || ',' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodeitem":' || fn_audit_escape_json(OLD.kodeitem) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"satuan":' || fn_audit_escape_json(OLD.satuan) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
      '"harga":' || coalesce(OLD.harga::text, '0') || ',' ||
      '"potongan":' || coalesce(OLD.potongan::text, '0') || ',' ||
      '"total":' || coalesce(OLD.total::text, '0') ||
    '}';

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_imdt', 'DELETE', 'PEMBELIAN', OLD.notransaksi, OLD.iddetail, OLD.kodeitem,
      NULL, NULL, OLD.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
      'ITEM PEMBELIAN DIHAPUS: ' || coalesce(OLD.kodeitem, '-') || ' (' || coalesce(OLD.jumlah::text, '0') || ' ' || coalesce(OLD.satuan, '') || ') @ ' || coalesce(OLD.harga::text, '0') || ', Subtotal: ' || coalesce(OLD.total::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN
      EXECUTE 'SELECT coalesce(user2, user1, ''SYSTEM''), coalesce(matauang, ''IDR'') FROM ' || quote_ident(TG_TABLE_SCHEMA) || '.tbl_imhd WHERE notransaksi = $1 LIMIT 1'
      INTO v_user_app, v_matauang
      USING NEW.notransaksi;
    EXCEPTION WHEN OTHERS THEN
      v_user_app := 'SYSTEM';
      v_matauang := 'IDR';
    END;
    v_matauang := coalesce(v_matauang, 'IDR');

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
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
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
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"harga":' || coalesce(NEW.harga::text, '0') || ',' ||
        '"potongan":' || coalesce(NEW.potongan::text, '0') || ',' ||
        '"total":' || coalesce(NEW.total::text, '0') ||
      '}';

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_imdt', 'UPDATE', 'PEMBELIAN', NEW.notransaksi, NEW.iddetail, NEW.kodeitem,
        NULL, NULL, NEW.total, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_tbl_imdt ON tbl_imdt;
CREATE TRIGGER trg_audit_tbl_imdt
AFTER UPDATE OR DELETE ON tbl_imdt
FOR EACH ROW EXECUTE PROCEDURE fn_audit_tbl_imdt();


-- ----------------------------------------------------------------------------
-- 6. TRIGGER KAS & BANK HEADER (tbl_acckashd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_acckashd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"tipe":' || fn_audit_escape_json(OLD.tipe) || ',' ||
      '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
      '"kodeaccto":' || fn_audit_escape_json(OLD.kodeaccto) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
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
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_acckashd', 'DELETE', 'KAS_BANK', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, NULL, OLD.jumlah, v_user_app, inet_client_addr()::text,
      'TRANSAKSI KAS/BANK DIHAPUS. No: ' || OLD.notransaksi || ', Tipe: ' || coalesce(OLD.tipe, '-') || ', Akun: ' || coalesce(OLD.kodeacc, '-') || ', Jumlah: ' || coalesce(OLD.jumlah::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.tanggal IS DISTINCT FROM NEW.tanggal THEN
      v_diff := v_diff || 'tanggal: ' || coalesce(OLD.tanggal::text, 'NULL') || ' -> ' || coalesce(NEW.tanggal::text, 'NULL') || '; ';
    END IF;
    IF OLD.kodeacc IS DISTINCT FROM NEW.kodeacc THEN
      v_diff := v_diff || 'kodeacc: ' || coalesce(OLD.kodeacc, 'NULL') || ' -> ' || coalesce(NEW.kodeacc, 'NULL') || '; ';
    END IF;
    IF OLD.kodeaccto IS DISTINCT FROM NEW.kodeaccto THEN
      v_diff := v_diff || 'kodeaccto: ' || coalesce(OLD.kodeaccto, 'NULL') || ' -> ' || coalesce(NEW.kodeaccto, 'NULL') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
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
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
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
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') || ',' ||
        '"user1":' || fn_audit_escape_json(NEW.user1) || ',' ||
        '"user2":' || fn_audit_escape_json(NEW.user2) ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_acckashd', 'UPDATE', 'KAS_BANK', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NULL, NEW.jumlah, v_user_app, inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
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
-- 7. TRIGGER KAS & BANK DETAIL (tbl_acckasdt)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_acckasdt()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
      '"nobaris":' || coalesce(OLD.nobaris::text, '0') || ',' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') ||
    '}';

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_acckasdt', 'DELETE', 'KAS_BANK', OLD.notransaksi, OLD.iddetail, NULL,
      NULL, NULL, OLD.jumlah, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
      'RINCIAN KAS DIHAPUS. No: ' || OLD.notransaksi || ', Akun: ' || coalesce(OLD.kodeacc, '-') || ', Jumlah: ' || coalesce(OLD.jumlah::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.kodeacc IS DISTINCT FROM NEW.kodeacc THEN
      v_diff := v_diff || 'kodeacc: ' || coalesce(OLD.kodeacc, 'NULL') || ' -> ' || coalesce(NEW.kodeacc, 'NULL') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
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
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
        '"jumlah":' || coalesce(OLD.jumlah::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(NEW.iddetail) || ',' ||
        '"nobaris":' || coalesce(NEW.nobaris::text, '0') || ',' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(NEW.kodeacc) || ',' ||
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') ||
      '}';

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_acckasdt', 'UPDATE', 'KAS_BANK', NEW.notransaksi, NEW.iddetail, NULL,
        NULL, NULL, NEW.jumlah, coalesce(v_user_app, 'SYSTEM'), inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
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
-- 8. TRIGGER JURNAL UMUM (tbl_accjurnal)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_accjurnal()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100) := 'SYSTEM';
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
      '"posisi":' || fn_audit_escape_json(OLD.posisi) || ',' ||
      '"debet":' || coalesce(OLD.debet::text, '0') || ',' ||
      '"kredit":' || coalesce(OLD.kredit::text, '0') || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) ||
    '}';

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_accjurnal', 'DELETE', 'AKUNTANSI', OLD.notransaksi, OLD.iddetail, NULL,
      OLD.kantor, NULL, coalesce(OLD.debet, OLD.kredit, OLD.jumlah, 0), v_user_app, inet_client_addr()::text,
      'AYAT JURNAL DIHAPUS. No: ' || OLD.notransaksi || ', Akun: ' || coalesce(OLD.kodeacc, '-') || ', Posisi: ' || coalesce(OLD.posisi, '-') || ', Nominal: ' || coalesce(coalesce(OLD.debet, OLD.kredit)::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.kodeacc IS DISTINCT FROM NEW.kodeacc THEN
      v_diff := v_diff || 'kodeacc: ' || coalesce(OLD.kodeacc, 'NULL') || ' -> ' || coalesce(NEW.kodeacc, 'NULL') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
    END IF;
    IF OLD.debet IS DISTINCT FROM NEW.debet THEN
      v_diff := v_diff || 'debet: ' || coalesce(OLD.debet::text, '0') || ' -> ' || coalesce(NEW.debet::text, '0') || '; ';
    END IF;
    IF OLD.kredit IS DISTINCT FROM NEW.kredit THEN
      v_diff := v_diff || 'kredit: ' || coalesce(OLD.kredit::text, '0') || ' -> ' || coalesce(NEW.kredit::text, '0') || '; ';
    END IF;
    IF OLD.posisi IS DISTINCT FROM NEW.posisi THEN
      v_diff := v_diff || 'posisi: ' || coalesce(OLD.posisi, '-') || ' -> ' || coalesce(NEW.posisi, '-') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(OLD.iddetail) || ',' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(OLD.kodeacc) || ',' ||
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
        '"posisi":' || fn_audit_escape_json(OLD.posisi) || ',' ||
        '"debet":' || coalesce(OLD.debet::text, '0') || ',' ||
        '"kredit":' || coalesce(OLD.kredit::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"iddetail":' || fn_audit_escape_json(NEW.iddetail) || ',' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodeacc":' || fn_audit_escape_json(NEW.kodeacc) || ',' ||
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"posisi":' || fn_audit_escape_json(NEW.posisi) || ',' ||
        '"debet":' || coalesce(NEW.debet::text, '0') || ',' ||
        '"kredit":' || coalesce(NEW.kredit::text, '0') ||
      '}';

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_accjurnal', 'UPDATE', 'AKUNTANSI', NEW.notransaksi, NEW.iddetail, NULL,
        NEW.kantor, NULL, coalesce(NEW.debet, NEW.kredit, NEW.jumlah, 0), v_user_app, inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
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
-- 9. TRIGGER BAYAR HUTANG (tbl_byrhutanghd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_byrhutanghd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
      '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') || ',' ||
      '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
      '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
      '"user2":' || fn_audit_escape_json(OLD.user2) || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) ||
    '}';

    v_user_app := coalesce(OLD.user2, OLD.user1, 'SYSTEM');

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_byrhutanghd', 'DELETE', 'HUTANG', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalbayar, v_user_app, inet_client_addr()::text,
      'PEMBAYARAN HUTANG DIHAPUS. No: ' || OLD.notransaksi || ', Supplier: ' || coalesce(OLD.kodesupel, '-') || ', Total: ' || coalesce(OLD.totalbayar::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.totalbayar IS DISTINCT FROM NEW.totalbayar THEN
      v_diff := v_diff || 'totalbayar: ' || coalesce(OLD.totalbayar::text, '0') || ' -> ' || coalesce(NEW.totalbayar::text, '0') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'supplier: ' || coalesce(OLD.kodesupel, '-') || ' -> ' || coalesce(NEW.kodesupel, '-') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
        '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"totalbayar":' || coalesce(NEW.totalbayar::text, '0') ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_byrhutanghd', 'UPDATE', 'HUTANG', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalbayar, v_user_app, inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
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
-- 10. TRIGGER BAYAR PIUTANG (tbl_byrpiutanghd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_byrpiutanghd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
      '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') || ',' ||
      '"carabayar":' || fn_audit_escape_json(OLD.carabayar) || ',' ||
      '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
      '"user2":' || fn_audit_escape_json(OLD.user2) || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) ||
    '}';

    v_user_app := coalesce(OLD.user2, OLD.user1, 'SYSTEM');

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_byrpiutanghd', 'DELETE', 'PIUTANG', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.totalbayar, v_user_app, inet_client_addr()::text,
      'PEMBAYARAN PIUTANG DIHAPUS. No: ' || OLD.notransaksi || ', Pelanggan: ' || coalesce(OLD.kodesupel, '-') || ', Total: ' || coalesce(OLD.totalbayar::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.totalbayar IS DISTINCT FROM NEW.totalbayar THEN
      v_diff := v_diff || 'totalbayar: ' || coalesce(OLD.totalbayar::text, '0') || ' -> ' || coalesce(NEW.totalbayar::text, '0') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'pelanggan: ' || coalesce(OLD.kodesupel, '-') || ' -> ' || coalesce(NEW.kodesupel, '-') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
        '"totalbayar":' || coalesce(OLD.totalbayar::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"totalbayar":' || coalesce(NEW.totalbayar::text, '0') ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_byrpiutanghd', 'UPDATE', 'PIUTANG', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.totalbayar, v_user_app, inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
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
-- 11. TRIGGER DEPOSIT (tbl_accdeposithd)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_tbl_accdeposithd()
RETURNS TRIGGER AS $$
DECLARE
  v_diff TEXT := '';
  v_old_json TEXT;
  v_new_json TEXT;
  v_user_app VARCHAR(100);
  v_matauang VARCHAR(10);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_matauang := coalesce(OLD.matauang, 'IDR');
    v_old_json := '{' ||
      '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
      '"kodekantor":' || fn_audit_escape_json(OLD.kodekantor) || ',' ||
      '"tanggal":' || fn_audit_escape_json(OLD.tanggal::text) || ',' ||
      '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
      '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
      '"jumlah":' || coalesce(OLD.jumlah::text, '0') || ',' ||
      '"user1":' || fn_audit_escape_json(OLD.user1) || ',' ||
      '"user2":' || fn_audit_escape_json(OLD.user2) || ',' ||
      '"keterangan":' || fn_audit_escape_json(OLD.keterangan) ||
    '}';

    v_user_app := coalesce(OLD.user2, OLD.user1, 'SYSTEM');

    INSERT INTO tbl_audit_log (
      schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
      kodekantor, kodesupel, total_transaksi, user_app, ip_client,
      perubahan_kolom, matauang, data_lama, data_baru
    ) VALUES (
      TG_TABLE_SCHEMA, 'tbl_accdeposithd', 'DELETE', 'DEPOSIT', OLD.notransaksi, NULL, NULL,
      OLD.kodekantor, OLD.kodesupel, OLD.jumlah, v_user_app, inet_client_addr()::text,
      'TRANSAKSI DEPOSIT DIHAPUS. No: ' || OLD.notransaksi || ', Supel: ' || coalesce(OLD.kodesupel, '-') || ', Jumlah: ' || coalesce(OLD.jumlah::text, '0'),
      v_matauang, v_old_json, NULL
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_matauang := coalesce(NEW.matauang, OLD.matauang, 'IDR');

    IF OLD.jumlah IS DISTINCT FROM NEW.jumlah THEN
      v_diff := v_diff || 'jumlah: ' || coalesce(OLD.jumlah::text, '0') || ' -> ' || coalesce(NEW.jumlah::text, '0') || '; ';
    END IF;
    IF OLD.kodesupel IS DISTINCT FROM NEW.kodesupel THEN
      v_diff := v_diff || 'supel: ' || coalesce(OLD.kodesupel, '-') || ' -> ' || coalesce(NEW.kodesupel, '-') || '; ';
    END IF;
    IF OLD.matauang IS DISTINCT FROM NEW.matauang THEN
      v_diff := v_diff || 'matauang: ' || coalesce(OLD.matauang, 'IDR') || ' -> ' || coalesce(NEW.matauang, 'IDR') || '; ';
    END IF;

    IF v_diff <> '' THEN
      v_old_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(OLD.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(OLD.kodesupel) || ',' ||
        '"matauang":' || fn_audit_escape_json(coalesce(OLD.matauang, 'IDR')) || ',' ||
        '"jumlah":' || coalesce(OLD.jumlah::text, '0') ||
      '}';

      v_new_json := '{' ||
        '"notransaksi":' || fn_audit_escape_json(NEW.notransaksi) || ',' ||
        '"kodesupel":' || fn_audit_escape_json(NEW.kodesupel) || ',' ||
        '"matauang":' || fn_audit_escape_json(v_matauang) || ',' ||
        '"jumlah":' || coalesce(NEW.jumlah::text, '0') ||
      '}';

      v_user_app := coalesce(NEW.user2, NEW.user1, OLD.user2, OLD.user1, 'SYSTEM');

      INSERT INTO tbl_audit_log (
        schema_name, table_name, action_type, modul, notransaksi, iddetail, kodeitem,
        kodekantor, kodesupel, total_transaksi, user_app, ip_client,
        perubahan_kolom, matauang, data_lama, data_baru
      ) VALUES (
        TG_TABLE_SCHEMA, 'tbl_accdeposithd', 'UPDATE', 'DEPOSIT', NEW.notransaksi, NULL, NULL,
        NEW.kodekantor, NEW.kodesupel, NEW.jumlah, v_user_app, inet_client_addr()::text,
        v_diff, v_matauang, v_old_json, v_new_json
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
