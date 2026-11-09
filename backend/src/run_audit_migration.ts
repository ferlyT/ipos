import { client } from "./db";
import { readFileSync } from "fs";
import { join } from "path";

async function runAuditMigration() {
  const args = process.argv.slice(2);
  const schemaArg = args.find(a => a.startsWith("--schema="));
  const targetSchema = schemaArg ? schemaArg.split("=")[1].trim() : "public";

  console.log("================================================================================");
  console.log(`🚀 Menjalankan Migrasi Database Trigger Audit Log pada Skema: [ ${targetSchema} ]`);
  console.log("================================================================================");

  try {
    // 0. Pastikan skema target ada
    const schemaCheck = await client`
      SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${targetSchema}
    `;
    if (schemaCheck.length === 0) {
      console.log(`  -> Skema '${targetSchema}' belum ada, membuat skema...`);
      await client.unsafe(`CREATE SCHEMA "${targetSchema}"`);
    }

    // Set search_path aktif ke target schema terlebih dahulu, lalu public
    await client.unsafe(`SET search_path = "${targetSchema}", public;`);

    // 1. Periksa dan buat tabel tbl_audit_log pada skema target jika belum ada
    const tableCheck = await client`
      SELECT 1 FROM information_schema.tables WHERE table_schema = ${targetSchema} AND table_name = 'tbl_audit_log'
    `;

    if (tableCheck.length === 0) {
      console.log(`  -> Membuat tabel '${targetSchema}.tbl_audit_log'...`);
      await client.unsafe(`
        CREATE TABLE "${targetSchema}".tbl_audit_log (
          id BIGSERIAL PRIMARY KEY,
          schema_name VARCHAR(50) NOT NULL DEFAULT '${targetSchema}',
          table_name VARCHAR(50) NOT NULL,
          action_type VARCHAR(10) NOT NULL,
          modul VARCHAR(20) NOT NULL,
          notransaksi VARCHAR(50) NOT NULL,
          iddetail VARCHAR(100),
          kodeitem VARCHAR(50),
          kodekantor VARCHAR(50),
          kodesupel VARCHAR(50),
          total_transaksi NUMERIC(15, 2),
          user_app VARCHAR(100),
          user_db VARCHAR(100) DEFAULT CURRENT_USER,
          ip_client VARCHAR(50),
          perubahan_kolom TEXT,
          data_lama TEXT,
          data_baru TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log(`  -> Tabel '${targetSchema}.tbl_audit_log' berhasil dibuat.`);
    } else {
      console.log(`  ℹ️  Tabel '${targetSchema}.tbl_audit_log' sudah ada.`);
      // Pastikan kolom schema_name sudah ada
      const colCheck = await client`
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = ${targetSchema} AND table_name = 'tbl_audit_log' AND column_name = 'schema_name'
      `;
      if (colCheck.length === 0) {
        console.log("  -> Menambahkan kolom 'schema_name' ke tbl_audit_log...");
        await client.unsafe(`ALTER TABLE "${targetSchema}".tbl_audit_log ADD COLUMN schema_name VARCHAR(50) DEFAULT '${targetSchema}';`);
      }
    }

    // 2. Indexing pada skema target
    const indexes = [
      { name: `idx_audit_log_notransaksi_${targetSchema}`, ddl: `CREATE INDEX idx_audit_log_notransaksi_${targetSchema} ON "${targetSchema}".tbl_audit_log (notransaksi)` },
      { name: `idx_audit_log_table_${targetSchema}`, ddl: `CREATE INDEX idx_audit_log_table_${targetSchema} ON "${targetSchema}".tbl_audit_log (table_name)` },
      { name: `idx_audit_log_modul_${targetSchema}`, ddl: `CREATE INDEX idx_audit_log_modul_${targetSchema} ON "${targetSchema}".tbl_audit_log (modul)` },
      { name: `idx_audit_log_action_${targetSchema}`, ddl: `CREATE INDEX idx_audit_log_action_${targetSchema} ON "${targetSchema}".tbl_audit_log (action_type)` },
      { name: `idx_audit_log_created_at_${targetSchema}`, ddl: `CREATE INDEX idx_audit_log_created_at_${targetSchema} ON "${targetSchema}".tbl_audit_log (created_at DESC)` },
      { name: `idx_audit_log_kodeitem_${targetSchema}`, ddl: `CREATE INDEX idx_audit_log_kodeitem_${targetSchema} ON "${targetSchema}".tbl_audit_log (kodeitem)` },
      { name: `idx_audit_log_schema_${targetSchema}`, ddl: `CREATE INDEX idx_audit_log_schema_${targetSchema} ON "${targetSchema}".tbl_audit_log (schema_name)` },
    ];

    for (const idx of indexes) {
      const idxCheck = await client`SELECT 1 FROM pg_class WHERE relname = ${idx.name}`;
      if (idxCheck.length === 0) {
        console.log(`  -> Membuat indeks '${idx.name}'...`);
        try {
          await client.unsafe(idx.ddl);
        } catch (e: any) {
          // Abaikan jika sudah ada dengan nama berbeda
        }
      }
    }

    // 3. Eksekusi Script Functions & Triggers pada target schema
    console.log(`  -> Memasang fungsi trigger dan trigger event pada skema [${targetSchema}]...`);
    const sqlPath = join(import.meta.dir, "db/migrations/20261107_audit_log_triggers.sql");
    const sqlContent = readFileSync(sqlPath, "utf-8");

    // Jalankan dengan search_path skema target
    await client.unsafe(`
      SET search_path = "${targetSchema}", public;
      ${sqlContent}
    `);

    console.log(`✅ Berhasil memasang trigger pada skema '${targetSchema}'!`);
    console.log("================================================================================");
    console.log(`🎉 Migrasi trigger audit log pada skema '${targetSchema}' selesai dengan sukses!`);
    console.log("================================================================================");
  } catch (error) {
    console.error("❌ Gagal menjalankan migrasi trigger audit log:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAuditMigration();
