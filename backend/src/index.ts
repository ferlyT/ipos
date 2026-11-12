import { startApiServer } from "./api/server";
import { runMigration } from "./run_wms_migration";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Pastikan tabel WMS dan seed awal sudah tersedia sebelum server menerima request
try {
  await runMigration(false);
} catch (err) {
  console.warn("⚠️ Peringatan: Inisialisasi migrasi WMS gagal, server tetap berjalan:", err);
}

startApiServer(PORT);
