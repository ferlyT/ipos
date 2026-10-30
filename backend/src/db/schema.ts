import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Contoh skema tabel pengguna (users)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Anda dapat mengekspor tipe inferensi Drizzle:
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
