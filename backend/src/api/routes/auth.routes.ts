import { sql } from "drizzle-orm";
import { db } from "../../db";
import { requireAuth, signJwt, type AuthUser } from "../middleware/auth";
import type { ApiRouter } from "../router";

export function registerAuthRoutes(router: ApiRouter) {
  // POST /api/auth/login - Autentikasi Pengguna & Penerbitan JWT
  router.post("/api/auth/login", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }

    const { userid, password } = ctx.body;
    if (!userid || typeof userid !== "string" || !password || typeof password !== "string") {
      return ctx.error("Parameter 'userid' dan 'password' wajib diisi", 400);
    }

    const cleanUserid = userid.trim().toUpperCase();

    // Query user dari tbl_user
    const users = await db.execute(sql`
      SELECT u.userid, u.nama, u.password, u.kelompok AS role, u.loginkantor AS kantor, u.tipe, u.loginshift
      FROM tbl_user u
      WHERE UPPER(u.userid) = ${cleanUserid}
      LIMIT 1;
    `);

    if (users.length === 0) {
      return ctx.error("User ID atau kata sandi tidak valid", 401, { code: "INVALID_CREDENTIALS" });
    }

    const userRecord = users[0] as any;
    const storedPassword = userRecord.password || "";

    let isPasswordValid = false;

    // Verifikasi kata sandi
    if (storedPassword.startsWith("$argon2") || storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
      // Hash modern (Argon2 / BCrypt)
      try {
        isPasswordValid = await Bun.password.verify(password, storedPassword);
        // Fallback case-insensitive untuk kompatibilitas desktop iPos 4.0 (VB.NET Option Compare Text)
        if (!isPasswordValid) {
          isPasswordValid =
            (await Bun.password.verify(password.toLowerCase(), storedPassword).catch(() => false)) ||
            (await Bun.password.verify(password.toUpperCase(), storedPassword).catch(() => false));
        }
      } catch {
        isPasswordValid = false;
      }
    } else {
      // Legacy plaintext iPos 4.0 fallback (case-insensitive sesuai sistem VB.NET iPos 4.0)
      isPasswordValid = storedPassword === password || storedPassword.toLowerCase() === password.toLowerCase();

      // Transparent upgrade ke hash modern jika verifikasi plaintext berhasil
      if (isPasswordValid) {
        try {
          const modernHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
          await db.execute(sql`
            UPDATE tbl_user
            SET password = ${modernHash}
            WHERE userid = ${userRecord.userid};
          `);
        } catch (upgradeErr) {
          console.warn("[Auth] Gagal upgrade hash password:", upgradeErr);
        }
      }
    }

    if (!isPasswordValid) {
      return ctx.error("User ID atau kata sandi tidak valid", 401, { code: "INVALID_CREDENTIALS" });
    }

    // Ambil matriks hak akses modul untuk role ini
    const permissions = await db.execute(sql`
      SELECT modulid, mopen, mnew, medit, mdel, mlock
      FROM tbl_userakses
      WHERE klpakses = ${userRecord.role};
    `);

    const permissionMap: Record<string, { open: boolean; new: boolean; edit: boolean; del: boolean; lock: boolean }> = {};
    for (const p of permissions as any[]) {
      permissionMap[p.modulid] = {
        open: Boolean(p.mopen),
        new: Boolean(p.mnew),
        edit: Boolean(p.medit),
        del: Boolean(p.mdel),
        lock: Boolean(p.mlock),
      };
    }

    // Terbitkan JWT (24 jam)
    const token = await signJwt({
      userid: userRecord.userid,
      nama: userRecord.nama,
      role: userRecord.role,
      kantor: userRecord.kantor || "UTM",
      loginshift: Boolean(userRecord.loginshift),
    }, 86400);

    return ctx.json({
      success: true,
      token,
      user: {
        userid: userRecord.userid,
        nama: userRecord.nama,
        role: userRecord.role,
        kantor: userRecord.kantor || "UTM",
        tipe: userRecord.tipe,
        loginshift: Boolean(userRecord.loginshift),
      },
      permissions: permissionMap,
    });
  });

  // GET /api/auth/me - Profil & Hak Akses Sesi Pengguna Aktif
  router.get("/api/auth/me", requireAuth(async (ctx) => {
    const authUser = (ctx as any).user as AuthUser;

    const userRes = await db.execute(sql`
      SELECT u.userid, u.nama, u.kelompok AS role, u.loginkantor AS kantor, u.tipe, u.loginshift
      FROM tbl_user u
      WHERE u.userid = ${authUser.userid}
      LIMIT 1;
    `);

    if (userRes.length === 0) {
      return ctx.error("Pengguna tidak ditemukan", 404);
    }

    const permissions = await db.execute(sql`
      SELECT modulid, mopen, mnew, medit, mdel, mlock
      FROM tbl_userakses
      WHERE klpakses = ${authUser.role};
    `);

    const permissionMap: Record<string, any> = {};
    for (const p of permissions as any[]) {
      permissionMap[p.modulid] = {
        open: Boolean(p.mopen),
        new: Boolean(p.mnew),
        edit: Boolean(p.medit),
        del: Boolean(p.mdel),
        lock: Boolean(p.mlock),
      };
    }

    return ctx.json({
      user: userRes[0],
      permissions: permissionMap,
    });
  }));

  // POST /api/auth/change-password - Ganti Kata Sandi Mandiri
  router.post("/api/auth/change-password", requireAuth(async (ctx) => {
    const authUser = (ctx as any).user as AuthUser;
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }

    const { oldPassword, newPassword } = ctx.body;
    if (!oldPassword || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return ctx.error("Kata sandi baru minimal harus 6 karakter", 400);
    }

    const userRecord = await db.execute(sql`
      SELECT password FROM tbl_user WHERE userid = ${authUser.userid} LIMIT 1;
    `);

    if (userRecord.length === 0) {
      return ctx.error("Pengguna tidak ditemukan", 404);
    }

    const stored = (userRecord[0] as any).password;
    let valid = false;
    if (stored.startsWith("$argon2") || stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
      valid = await Bun.password.verify(oldPassword, stored);
    } else {
      valid = stored === oldPassword;
    }

    if (!valid) {
      return ctx.error("Kata sandi lama salah", 400);
    }

    const newHash = await Bun.password.hash(newPassword, { algorithm: "bcrypt", cost: 10 });
    await db.execute(sql`
      UPDATE tbl_user
      SET password = ${newHash}
      WHERE userid = ${authUser.userid};
    `);

    return ctx.json({ success: true, message: "Kata sandi berhasil diperbarui" });
  }));
}
