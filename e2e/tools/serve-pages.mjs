/**
 * Serves frontend/dist the way GitHub Pages does, under the /topos/ base:
 * an exact file, else <dir>/index.html, else 404.html with status 404.
 * No SPA rewrite - that is the point: the specs under e2e/pages/ prove
 * the prerendered routes and the service worker cope without one.
 *
 * Used by playwright.pages.config.ts as its webServer; standalone:
 *   node tools/serve-pages.mjs        # PAGES_PORT (4174), PAGES_DIST
 */
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = process.env.PAGES_DIST ?? fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
const BASE = "/topos/";
const PORT = Number(process.env.PAGES_PORT ?? 4174);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolve(pathname) {
  if (!pathname.startsWith(BASE)) return { status: 404, file: join(DIST, "404.html") };
  const relative = normalize(decodeURIComponent(pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [join(DIST, relative), join(DIST, relative, "index.html")]) {
    if (await isFile(candidate)) return { status: 200, file: candidate };
  }
  return { status: 404, file: join(DIST, "404.html") };
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const { status, file } = await resolve(pathname);
  try {
    const body = await readFile(file);
    response.writeHead(status, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(String(error));
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`serving ${DIST} at http://127.0.0.1:${PORT}${BASE}`);
});
