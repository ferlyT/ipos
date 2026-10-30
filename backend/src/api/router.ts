export interface ApiContext {
  req: Request;
  url: URL;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  json: (data: any, status?: number) => Response;
  error: (message: string, status?: number, details?: any) => Response;
}

export type RouteHandler = (ctx: ApiContext) => Promise<Response> | Response;

interface RouteDefinition {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

// Simple in-memory sliding-window Rate Limiter (mitigates DoS and Brute Force)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string, isSensitiveRoute: boolean): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 menit
  const maxRequests = isSensitiveRoute ? 30 : 600; // 30 req/min untuk auth/backup, 600 req/min untuk lainnya

  const key = `${ip}:${isSensitiveRoute ? "auth" : "general"}`;
  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

// Clean up stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export class ApiRouter {
  private routes: RouteDefinition[] = [];

  private register(method: string, path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    const regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });

    const pattern = new RegExp(`^${regexPath}$`);
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      paramNames,
      handler,
    });
  }

  get(path: string, handler: RouteHandler) {
    this.register("GET", path, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.register("POST", path, handler);
  }

  put(path: string, handler: RouteHandler) {
    this.register("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler) {
    this.register("DELETE", path, handler);
  }

  /**
   * Resolve CORS origin dynamically based on allowed origins or localhost/LAN
   */
  private resolveCorsOrigin(req: Request): string {
    const origin = req.headers.get("Origin") || req.headers.get("origin") || "";
    if (!origin) return "*";

    // Whitelist rules: localhost, 127.0.0.1, private LAN (192.168.*, 10.*, 172.16-31.*), or ALLOWED_ORIGINS env
    const allowedEnv = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allowedEnv.includes(origin)) return origin;

    try {
      const parsed = new URL(origin);
      const host = parsed.hostname;
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        /^192\.168\.\d+\.\d+$/.test(host) ||
        /^10\.\d+\.\d+\.\d+$/.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)
      ) {
        return origin;
      }
    } catch {
      // invalid URL
    }

    return allowedEnv.length > 0 ? allowedEnv[0] : "*";
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const allowedOrigin = this.resolveCorsOrigin(req);

    // Standard Industry Security Headers (OWASP A05)
    const securityHeaders: Record<string, string> = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
      "Access-Control-Max-Age": "86400",
    };

    // CORS Preflight Options
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: securityHeaders,
      });
    }

    // Rate Limiting Check
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const isSensitive = pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/system/database");
    const rateCheck = checkRateLimit(clientIp, isSensitive);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Terlalu banyak permintaan (Rate limit exceeded). Silakan coba sesaat lagi.",
          retryAfter: rateCheck.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": String(rateCheck.retryAfter || 60),
            ...securityHeaders,
          },
        }
      );
    }

    // CORS & JSON response helper
    const makeResponse = (body: string, status: number = 200, extraHeaders: HeadersInit = {}) => {
      return new Response(body, {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...securityHeaders,
          ...extraHeaders,
        },
      });
    };

    // Query params map
    const query: Record<string, string> = {};
    url.searchParams.forEach((val, key) => {
      query[key] = val;
    });

    // Parse body safely
    let body: any = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = await req.json();
        } catch {
          body = null;
        }
      }
    }

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, idx) => {
          params[name] = decodeURIComponent(match[idx + 1]);
        });

        const ctx: ApiContext = {
          req,
          url,
          params,
          query,
          body,
          json: (data, status = 200) =>
            makeResponse(JSON.stringify({ success: true, data }), status),
          error: (message, status = 400, details = null) =>
            makeResponse(
              JSON.stringify({
                success: false,
                error: message,
                ...(details ? { details } : {}),
              }),
              status
            ),
        };

        try {
          return await route.handler(ctx);
        } catch (err: any) {
          console.error(`[API Error] ${method} ${pathname}:`, err);
          // Do not leak stack traces or internal query logic in production responses
          const safeMessage = process.env.NODE_ENV === "production"
            ? "Terjadi kesalahan internal pada server"
            : err.message || "Internal Server Error";
          return ctx.error(safeMessage, 500);
        }
      }
    }

    // 404 Not Found
    return makeResponse(
      JSON.stringify({
        success: false,
        error: `Endpoint '${method} ${pathname}' tidak ditemukan`,
      }),
      404
    );
  }
}
