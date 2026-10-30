import { sql } from "drizzle-orm";
import { db } from "./db";

async function run() {
  console.log("Altering tbl_user.password column to VARCHAR(120)...");
  await db.execute(sql`ALTER TABLE tbl_user ALTER COLUMN password TYPE VARCHAR(120);`);
  console.log("✅ Column successfully altered to VARCHAR(120)!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
