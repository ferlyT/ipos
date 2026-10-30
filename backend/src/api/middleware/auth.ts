import { sql } from "drizzle-orm";
import { db } from "../../db";
import type { ApiContext, RouteHandler } from "../router";

const JWT_SECRET = process.env.JWT_SECRET || "ipos4-enterprise-jwt-secret-key-2026-production-grade";

export interface TokenPayload {
  userid: string;
  nama: string;
  role: string;
  kantor: string;
  loginshift: boolean;
  iat: number;
  exp: number;
}

export interface AuthUser {
  userid: string;
  nama: string;
  role: string;
  kantor: string;
  loginshift: boolean;
}

// Base64URL encoder/decoder
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return Buffer.from(str, "base64").toString("utf-8");
}

// Generate HMAC-SHA256 Signature using Bun crypto
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256", secret);
  hasher.update(data);
  return hasher.digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Generate a signed JWT token
 */
export async function signJwt(
  payload: Omit<TokenPayload, "iat" | "exp">,
  expiresInSeconds: number = 86400 // default 24 hours
): Promise<string> {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = await createHmacSignature(data, JWT_SECRET);
  return `${data}.${signature}`;
}

/**
 * Verify and decode JWT token
 */
export async function verifyJwt(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = await createHmacSignature(data, JWT_SECRET);
    if (signature !== expectedSignature) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      // Token expired
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract auth user from Request Authorization header
 */
export async function extractAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) return null;

  let token = authHeader.trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  const payload = await verifyJwt(token);
  if (!payload) return null;

  return {
    userid: payload.userid,
    nama: payload.nama,
    role: payload.role,
    kantor: payload.kantor,
    loginshift: payload.loginshift,
  };
}

/**
 * Middleware wrapper to enforce Authentication & RBAC on routes
 */
export function requireAuth(
  handler: RouteHandler,
  options?: {
    requiredRole?: string;
    requiredModul?: string;
    action?: "mopen" | "mnew" | "medit" | "mdel";
  }
): RouteHandler {
  return async (ctx: ApiContext) => {
    const user = await extractAuthUser(ctx.req);
    if (!user) {
      return ctx.error("Akses ditolak: Autentikasi Bearer Token diperlukan", 401, {
        code: "UNAUTHORIZED",
      });
    }

    // Assign authenticated user to context
    (ctx as any).user = user;

    // Check specific role if required
    if (options?.requiredRole && user.role.toUpperCase() !== options.requiredRole.toUpperCase()) {
      return ctx.error(`Akses ditolak: Memerlukan peran ${options.requiredRole}`, 403, {
        code: "FORBIDDEN_ROLE",
      });
    }

    // Check module permission in tbl_userakses if specified
    if (options?.requiredModul) {
      const action = options.action || "mopen";
      // Administrator bypass
      if (user.role.toUpperCase() !== "ADMINISTRATOR") {
        const perms = await db.execute(sql`
          SELECT mopen, mnew, medit, mdel
          FROM tbl_userakses
          WHERE klpakses = ${user.role} AND modulid = ${options.requiredModul}
          LIMIT 1;
        `);

        if (perms.length === 0 || !(perms[0] as any)[action]) {
          return ctx.error(
            `Akses ditolak: Peran '${user.role}' tidak memiliki izin '${action}' pada modul '${options.requiredModul}'`,
            403,
            { code: "FORBIDDEN_PERMISSION" }
          );
        }
      }
    }

    return handler(ctx);
  };
}
