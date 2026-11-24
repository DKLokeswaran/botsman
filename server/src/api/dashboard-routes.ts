import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { ApiError } from "../errors.ts";
import type { Services } from "../services.ts";

const PUBLIC = { config: { public: true } };

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// The page may load only its own files, and talk only to the server that served it.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Serves the web dashboard's built files under /app. Its screens are a single page, so any path that is not a
// file gets the page itself, and the page's own router takes it from there.
export function registerDashboardRoutes(app: FastifyInstance, services: Services): void {
  const root = services.config.dashboardDir;

  for (const url of ["/", "/app"]) app.get(url, PUBLIC, async (_request, reply) => reply.redirect("/app/"));

  app.get<{ Params: { "*": string } }>("/app/*", PUBLIC, async (request, reply) => {
    const file = await dashboardFile(root, request.params["*"]);
    return file === undefined ? sendPage(reply, root) : sendFile(reply, file);
  });
}

// The file a request names, when it exists inside the dashboard folder.
async function dashboardFile(root: string, requested: string): Promise<string | undefined> {
  if (requested === "" || requested.includes("\0")) return undefined;
  const file = path.resolve(root, requested);
  if (!file.startsWith(root + path.sep)) return undefined;
  const info = await stat(file).catch(() => undefined);
  return info?.isFile() ? file : undefined;
}

// Files under assets/ carry a hash of their content in the name, so a browser may keep them for good.
async function sendFile(reply: FastifyReply, file: string): Promise<FastifyReply> {
  const hashed = file.includes(`${path.sep}assets${path.sep}`);
  return reply
    .header("content-type", CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream")
    .header("cache-control", hashed ? "public, max-age=31536000, immutable" : "no-cache")
    .header("x-content-type-options", "nosniff")
    .send(await readFile(file));
}

async function sendPage(reply: FastifyReply, root: string): Promise<FastifyReply> {
  const page = await readFile(path.join(root, "index.html")).catch(() => undefined);
  if (page === undefined) throw new ApiError(503, "dashboard_missing", "The web dashboard is not built on this server", "Run deploy/install.sh, or pnpm --filter @botsman/web build");
  return reply
    .header("content-type", CONTENT_TYPES[".html"])
    .header("cache-control", "no-cache")
    .header("x-content-type-options", "nosniff")
    .header("content-security-policy", CONTENT_SECURITY_POLICY)
    .header("referrer-policy", "no-referrer")
    .send(page);
}
