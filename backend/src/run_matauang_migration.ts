import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const LOCAL_URL = "postgresql://admin:md51de468d6af1debdc21fe529310b29a3f@localhost:5444/i4_baruna31okt26";
const REMOTE_URL = "postgresql://admin:md51de468d6af1debdc21fe529310b29a3f@26.235.119.106:5444/i4_baruna";
const REMOTE_BALNOV_URL = "postgresql://admin:md51de468d6af1debdc21fe529310b29a3f@26.235.119.106:5444/i4_BalNov2026";

async function migrateDatabase(dbUrl: string, label: string) {
  console.log(`\n================================================================================`);
  console.log(`🚀 Menjalankan Migrasi Kolom Mata Uang pada: [ ${label} ]`);
  console.log(`================================================================================`);
  
  const sql = postgres(dbUrl, { connect_timeout: 10, idle_timeout: 10 });
  try {
    // 1. Cek dan tambahkan kolom matauang jika belum ada (Kompatibel PostgreSQL 8.4)
    const checkCol = await sql`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tbl_audit_log' AND column_name = 'matauang';
    `;
    if (checkCol.length === 0) {
      console.log(`  -> Menambahkan kolom 'matauang' ke tbl_audit_log...`);
      await sql.unsafe(`ALTER TABLE tbl_audit_log ADD COLUMN matauang VARCHAR(10) DEFAULT 'IDR';`);
    }
    await sql.unsafe(`UPDATE tbl_audit_log SET matauang = 'IDR' WHERE matauang IS NULL;`);

    const sqlPath = join(import.meta.dir, "db/migrations/20261110_audit_log_matauang.sql");
    const sqlContent = readFileSync(sqlPath, "utf-8");

    console.log(`  -> Memperbarui seluruh fungsi trigger dengan matauang pada ${label}...`);
    await sql.unsafe(sqlContent);

    // Verifikasi kolom matauang
    const verifyCol = await sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_audit_log' AND column_name = 'matauang';
    `;
    console.log(`  -> Status kolom matauang:`, verifyCol);

    // Hitung record
    const countRes = await sql`
      SELECT COUNT(*)::int as total, COUNT(matauang)::int as with_curr FROM tbl_audit_log;
    `;
    console.log(`  -> Statistik tabel audit:`, countRes[0]);

    console.log(`✅ Sukses menerapkan migrasi matauang pada [ ${label} ]!`);
  } catch (err) {
    console.error(`❌ Gagal pada [ ${label} ]:`, err);
    throw err;
  } finally {
    await sql.end();
  }
}

async function main() {
  console.log("Mulai migrasi kolom mata uang audit log...");
  // 1. Local
  await migrateDatabase(LOCAL_URL, "LOCAL: localhost:5444/i4_baruna31okt26");
  
  // 2. Remote Baruna
  await migrateDatabase(REMOTE_URL, "REMOTE: 26.235.119.106:5444/i4_baruna");

  // 3. Remote BalNov2026
  await migrateDatabase(REMOTE_BALNOV_URL, "REMOTE: 26.235.119.106:5444/i4_BalNov2026");

  console.log("\n🎉 SELURUH DATABASE BERHASIL DIMIGRASI DENGAN KOLOM MATA UANG!");
}

main().catch((e) => {
  console.error("Migrasi gagal:", e);
  process.exit(1);
});
