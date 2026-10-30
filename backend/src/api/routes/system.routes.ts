import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "../../db";
import { OrderPromotionService } from "../../services/order-promotion.service";
import { requireAuth } from "../middleware/auth";
import type { ApiRouter } from "../router";

export function registerSystemRoutes(router: ApiRouter) {
  // GET /api/system/health - Ping & Status
  router.get("/api/system/health", async (ctx) => {
    const start = performance.now();
    const result = await db.execute(sql`
      SELECT NOW() as server_time, version() as pg_version, current_database() as database_name;
    `);
    const tables = await db.execute(sql`
      SELECT count(*)::int as total_tables FROM information_schema.tables WHERE table_schema = 'public';
    `);
    const latencyMs = Number((performance.now() - start).toFixed(2));

    return ctx.json({
      status: "ONLINE",
      database: (result[0] as any).database_name,
      pgVersion: (result[0] as any).pg_version,
      serverTime: (result[0] as any).server_time,
      totalTables: (tables[0] as any).total_tables,
      latencyMs,
      bunVersion: Bun.version,
    });
  });

  // GET /api/system/config - Konfigurasi Sistem Global (tbl_conf)
  router.get("/api/system/config", async (ctx) => {
    const config = await OrderPromotionService.getSystemConfigurations();
    return ctx.json(config);
  });

  // GET /api/system/users - Daftar Pengguna & Operator Sistem
  router.get("/api/system/users", async (ctx) => {
    const users = await db.execute(sql`
      SELECT u.userid, u.nama, u.kelompok AS usergrup, u.loginkantor AS kantor, u.tipe, u.loginshift
      FROM tbl_user u
      ORDER BY u.userid ASC;
    `);
    return ctx.json(users);
  });

  // GET /api/system/roles - Daftar Kelompok Hak Akses / Role (tbl_userg)
  router.get("/api/system/roles", async (ctx) => {
    const groups = await db.execute(sql`
      SELECT g.kelompok, g.urut, count(u.userid)::int as total_users
      FROM tbl_userg g
      LEFT JOIN tbl_user u ON g.kelompok = u.kelompok
      GROUP BY g.kelompok, g.urut
      ORDER BY g.urut ASC;
    `);
    return ctx.json(groups);
  });

  // GET /api/system/roles/permissions?role=... - Matriks Hak Akses Modul (tbl_userakses)
  router.get("/api/system/roles/permissions", async (ctx) => {
    const role = ctx.query.role || "ADMINISTRATOR";
    const perms = await db.execute(sql`
      SELECT 
        a.klpakses,
        a.modulid,
        a.mopen,
        a.mnew,
        a.medit,
        a.mdel,
        a.mlock,
        a.urut,
        a.kelompok
      FROM tbl_userakses a
      WHERE a.klpakses = ${role}
      ORDER BY a.urut ASC, a.modulid ASC;
    `);
    return ctx.json(perms);
  });

  // PUT /api/system/roles/permissions - Simpan Perubahan Hak Akses Modul
  router.put("/api/system/roles/permissions", requireAuth(async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { role, modulid, field, value } = ctx.body;
    if (!role || !modulid || !field) {
      return ctx.error("Parameter 'role', 'modulid', dan 'field' wajib diisi", 400);
    }

    const safeFieldMap: Record<string, any> = {
      mopen: sql`mopen`,
      mnew: sql`mnew`,
      medit: sql`medit`,
      mdel: sql`mdel`,
      mlock: sql`mlock`,
    };

    const targetCol = safeFieldMap[field];
    if (!targetCol) {
      return ctx.error(`Field '${field}' tidak valid`, 400);
    }

    const boolVal = Boolean(value);
    await db.execute(sql`
      UPDATE tbl_userakses
      SET ${targetCol} = ${boolVal}
      WHERE klpakses = ${role} AND modulid = ${modulid};
    `);

    return ctx.json({ success: true, role, modulid, field, value: boolVal });
  }, { requiredRole: "ADMINISTRATOR" }));

  // GET /api/system/audit-trail?module=...&search=...&limit=100 - Unified Activity & Audit Trail
  router.get("/api/system/audit-trail", async (ctx) => {
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 100;
    const filterModule = ctx.query.module;
    const search = ctx.query.search;

    const raw = await db.execute(sql`
      SELECT * FROM (
        SELECT 
          'PENJUALAN' AS modul,
          ik.notransaksi,
          ik.tanggal::timestamp AS waktu,
          ik.kodekantor,
          COALESCE(ik.user1, 'ADMIN') AS operator,
          ('Penjualan ' || ik.carabayar || ' - ' || COALESCE(sp.nama, ik.kodesupel)) AS deskripsi,
          ik.totalakhir::numeric AS nominal,
          'SUKSES' AS status
        FROM tbl_ikhd ik
        LEFT JOIN tbl_supel sp ON ik.kodesupel = sp.kode

        UNION ALL

        SELECT 
          'PEMBELIAN' AS modul,
          im.notransaksi,
          im.tanggal::timestamp AS waktu,
          im.kodekantor,
          COALESCE(im.user1, 'ADMIN') AS operator,
          ('Pembelian ' || im.carabayar || ' - ' || COALESCE(sp.nama, im.kodesupel)) AS deskripsi,
          im.totalakhir::numeric AS nominal,
          'SUKSES' AS status
        FROM tbl_imhd im
        LEFT JOIN tbl_supel sp ON im.kodesupel = sp.kode

        UNION ALL

        SELECT 
          'TRANSFER' AS modul,
          tr.notransaksi,
          tr.tanggal::timestamp AS waktu,
          tr.kodekantor,
          COALESCE(tr.user1, 'ADMIN') AS operator,
          ('Mutasi Antar Gudang: ' || tr.kantordari || ' -> ' || tr.kantortujuan || ' (' || tr.totalitem || ' item)') AS deskripsi,
          tr.totalitem::numeric AS nominal,
          'SELESAI' AS status
        FROM tbl_itrhd tr

        UNION ALL

        SELECT 
          'KAS_BANK' AS modul,
          k.notransaksi,
          k.tanggal::timestamp AS waktu,
          k.kodekantor,
          COALESCE(k.user1, 'ADMIN') AS operator,
          (k.tipe || ': ' || k.keterangan) AS deskripsi,
          k.jumlah::numeric AS nominal,
          'POSTED' AS status
        FROM tbl_acckashd k
      ) AS activity
      ORDER BY waktu DESC
      LIMIT ${limit * 2};
    `);

    let list = raw as any[];

    if (filterModule && filterModule !== "ALL") {
      list = list.filter((a) => a.modul === filterModule);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.notransaksi.toLowerCase().includes(q) ||
          a.operator.toLowerCase().includes(q) ||
          a.deskripsi.toLowerCase().includes(q)
      );
    }

    return ctx.json(list.slice(0, limit));
  });

  // GET /api/system/database/stats - PostgreSQL Storage & Engine Health
  router.get("/api/system/database/stats", async (ctx) => {
    const dbSizeRes = await db.execute(sql`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as dbsize,
        pg_database_size(current_database())::bigint as dbsize_bytes,
        current_database() as dbname,
        version() as pgversion;
    `);

    const dbStatRes = await db.execute(sql`
      SELECT 
        numbackends::int as numbackends,
        xact_commit::bigint as xact_commit,
        xact_rollback::bigint as xact_rollback,
        blks_read::bigint as blks_read,
        blks_hit::bigint as blks_hit,
        ROUND(blks_hit * 100.0 / NULLIF(blks_hit + blks_read, 0), 2)::numeric as hit_ratio
      FROM pg_stat_database
      WHERE datname = current_database();
    `);

    const tableSizes = await db.execute(sql`
      SELECT 
        c.relname as table_name,
        c.reltuples::bigint as estimated_rows,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_total_relation_size(c.oid)::bigint as size_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC;
    `);

    const dbInfo = (dbSizeRes[0] as any) || {};
    const dbStat = (dbStatRes[0] as any) || {};

    return ctx.json({
      dbname: dbInfo.dbname,
      dbsize: dbInfo.dbsize,
      dbsizeBytes: Number(dbInfo.dbsize_bytes || 0),
      pgversion: dbInfo.pgversion,
      numbackends: dbStat.numbackends || 1,
      xactCommit: Number(dbStat.xact_commit || 0),
      xactRollback: Number(dbStat.xact_rollback || 0),
      hitRatio: Number(dbStat.hit_ratio || 0),
      tablesCount: (tableSizes as any[]).length,
      tables: (tableSizes as any[]).map((t) => ({
        tableName: t.table_name,
        estimatedRows: Number(t.estimated_rows || 0),
        totalSize: t.total_size,
        sizeBytes: Number(t.size_bytes || 0),
      })),
    });
  });

  // POST /api/system/database/vacuum - Optimasi Database VACUUM ANALYZE
  router.post("/api/system/database/vacuum", requireAuth(async (ctx) => {
    const tableName = ctx.body?.table;
    const start = performance.now();

    if (tableName) {
      // Validasi nama tabel aman (alfanumerik + underscore)
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return ctx.error("Nama tabel tidak valid", 400);
      }
      await db.execute(sql.raw(`VACUUM ANALYZE "${tableName}"`));
    } else {
      await db.execute(sql.raw("VACUUM ANALYZE"));
    }

    const elapsedMs = Number((performance.now() - start).toFixed(2));
    return ctx.json({
      success: true,
      target: tableName || "SELURUH DATABASE",
      elapsedMs,
      timestamp: new Date().toISOString(),
    });
  }, { requiredRole: "ADMINISTRATOR" }));

  // POST /api/system/database/backup - Buat Cadangan Database (pg_dump)
  router.post("/api/system/database/backup", requireAuth(async (ctx) => {
    const start = performance.now();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `backup_ipos4_${timestamp}.dump`;
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const filepath = path.join(backupDir, filename);

    const dbHost = process.env.DB_HOST || "localhost";
    const dbPort = process.env.DB_PORT || "5444";
    const dbUser = process.env.DB_USER || "admin";
    const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || "admin";
    const dbName = process.env.DB_NAME || "i4_barunatrial";

    const pgDumpPath = "c:\\Program Files (x86)\\Program Kreatif\\Program iPos 4.0\\dbutils\\pg_dump.exe";
    const proc = Bun.spawn([
      pgDumpPath,
      "-h", dbHost,
      "-p", dbPort,
      "-U", dbUser,
      "-F", "c",
      "-b",
      "-f", filepath,
      dbName,
    ], {
      env: { ...process.env, PGPASSWORD: dbPassword },
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return ctx.error(`pg_dump gagal dengan exit code ${exitCode}`, 500);
    }

    const stat = fs.statSync(filepath);
    const elapsedMs = Number((performance.now() - start).toFixed(2));

    return ctx.json({
      success: true,
      filename,
      filepath,
      sizeBytes: stat.size,
      sizeFormatted: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
      elapsedMs,
      createdAt: now.toISOString(),
      downloadUrl: `/api/system/database/backup/download?filename=${filename}`,
    });
  }, { requiredRole: "ADMINISTRATOR" }));

  // GET /api/system/database/backups - Daftar File Cadangan
  router.get("/api/system/database/backups", async (ctx) => {
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      return ctx.json([]);
    }
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".dump") || f.endsWith(".sql"));
    const list = files.map((filename) => {
      const filepath = path.join(backupDir, filename);
      const stat = fs.statSync(filepath);
      return {
        filename,
        sizeBytes: stat.size,
        sizeFormatted: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
        createdAt: stat.mtime.toISOString(),
        downloadUrl: `/api/system/database/backup/download?filename=${filename}`,
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return ctx.json(list);
  });

  // GET /api/system/database/backup/download - Unduh File Cadangan
  router.get("/api/system/database/backup/download", async (ctx) => {
    const filename = ctx.query.filename;
    if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      return ctx.error("Parameter filename tidak valid", 400);
    }
    const backupDir = path.resolve(process.cwd(), "backups");
    const filepath = path.join(backupDir, filename);
    if (!fs.existsSync(filepath)) {
      return ctx.error("Berkas cadangan tidak ditemukan", 404);
    }
    const file = Bun.file(filepath);
    return new Response(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });

  // GET /api/system/settings - Konfigurasi Identitas Toko & Parameter Sistem
  router.get("/api/system/settings", async (ctx) => {
    const rows = await db.execute(sql`
      SELECT confname, confvalue FROM tbl_conf;
    `);
    const map: Record<string, string | null> = {};
    for (const r of rows as any[]) {
      map[String(r.confname).trim()] = r.confvalue !== null ? String(r.confvalue).trim() : null;
    }
    return ctx.json({
      namaPerusahaan: map["CMP_NAMA"] || "CV. BARUNA ARTHA LESTARI",
      alamat1: map["CMP_ALAMAT1"] || "",
      alamat2: map["CMP_ALAMAT2"] || "",
      telepon: map["CMP_TELP"] || "",
      npwp: map["CMP_NPWP"] || "",
      defaultPajakJual: Number(map["DEFAULT_PAJAK_JUAL"] || 11),
      defaultPajakBeli: Number(map["DEFAULT_PAJAK_BELI"] || 11),
      metodeHpp: map["METHOD_HPP"] || "FIFO",
      mataUangUtama: map["ACC_MU_UTAMA"] || "IDR",
      hariJatuhTempoDefault: Number(map["DEF_JATUH_TEMPO"] || 10),
      raw: map,
    });
  });

  // PUT /api/system/settings - Perbarui Konfigurasi Toko & Sistem
  router.put("/api/system/settings", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { namaPerusahaan, alamat1, alamat2, telepon, npwp, defaultPajakJual, defaultPajakBeli, hariJatuhTempoDefault } = ctx.body;

    const updates: [string, string][] = [];
    if (namaPerusahaan !== undefined) updates.push(["CMP_NAMA", namaPerusahaan]);
    if (alamat1 !== undefined) updates.push(["CMP_ALAMAT1", alamat1]);
    if (alamat2 !== undefined) updates.push(["CMP_ALAMAT2", alamat2]);
    if (telepon !== undefined) updates.push(["CMP_TELP", telepon]);
    if (npwp !== undefined) updates.push(["CMP_NPWP", npwp]);
    if (defaultPajakJual !== undefined) updates.push(["DEFAULT_PAJAK_JUAL", String(defaultPajakJual)]);
    if (defaultPajakBeli !== undefined) updates.push(["DEFAULT_PAJAK_BELI", String(defaultPajakBeli)]);
    if (hariJatuhTempoDefault !== undefined) updates.push(["DEF_JATUH_TEMPO", String(hariJatuhTempoDefault)]);

    for (const [k, v] of updates) {
      await db.execute(sql`
        UPDATE tbl_conf SET confvalue = ${v} WHERE confname = ${k};
      `);
    }

    return ctx.json({ success: true, updatedCount: updates.length });
  });
}
