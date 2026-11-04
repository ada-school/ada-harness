// Edit src/http/static.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Static files: the chat (app/) and the documentation (docs/). Nothing else is served.

import { promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { paths } from "../config.js";
import { text } from "../text.js";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/**
 * Maps a URL to a file inside app/ or docs/. Returns null if it falls outside.
 *   /            -> app/index.html
 *   /docs/x.html -> docs/x.html
 *   /js/main.js  -> app/js/main.js
 * @param {string} url
 * @returns {string | null}
 */
export function resolveStatic(url: string): string | null {
  let clean: string;
  try { clean = decodeURIComponent(url.split("?")[0]); } catch { return null; }
  const abs = clean === "/"
    ? path.join(paths.app, "index.html")
    : clean.startsWith("/docs/")
      ? path.resolve(paths.docs, "." + clean.slice("/docs".length))
      : path.resolve(paths.app, "." + clean);
  const permitido = [paths.app, paths.docs].some((d) => {
    const rel = path.relative(d, abs);
    return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
  });
  return permitido ? abs : null;
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const abs = resolveStatic(req.url || "/");
  if (!abs) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: text("outside") }));
    return;
  }
  try {
    const data = await fs.readFile(abs);
    res.writeHead(200, { "content-type": TYPES[path.extname(abs)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: text("notFound") }));
  }
}
