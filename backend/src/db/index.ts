import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️  DATABASE_URL belum diatur di file .env. Menggunakan default localhost:5432/postgres");
}

const dbUrl = connectionString || "postgresql://postgres:postgres@localhost:5432/postgres";

// Inisialisasi client postgres (connection pool)
export const client = postgres(dbUrl, {
  max: 10, // batas pool koneksi
  idle_timeout: 20,
  connect_timeout: 10,
});

// Inisialisasi Drizzle ORM dengan schema
export const db = drizzle(client, { schema });

export default db;
