// Archivos estáticos: el chat (app/) y la documentación (docs/). Nada más se sirve.

import { promises as fs } from "node:fs";
import path from "node:path";
import { paths } from "../config.js";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/**
 * Traduce una URL a un archivo dentro de app/ o docs/. Devuelve null si cae afuera.
 *   /            -> app/index.html
 *   /docs/x.html -> docs/x.html
 *   /js/main.js  -> app/js/main.js
 * @param {string} url
 * @returns {string | null}
 */
export function resolveStatic(url) {
  let clean;
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
export async function serveStatic(req, res) {
  const abs = resolveStatic(req.url || "/");
  if (!abs) {
    res.writeHead(403, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "fuera de app/ y docs/" }));
  }
  try {
    const data = await fs.readFile(abs);
    res.writeHead(200, { "content-type": TYPES[path.extname(abs)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "no existe" }));
  }
}
