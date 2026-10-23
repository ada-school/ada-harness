// Servidor mínimo: sirve app/ y docs/, y expone POST /api/chat.
// Sin dependencias. Node 18+.

import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ROOT } from "./context.js";
import { turn } from "./harness.js";

// Carga .env si existe (sin dependencia).
try {
  const env = await fs.readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const PORT = Number(process.env.PORT || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

// Historial por sesión, en memoria del proceso. Para persistencia, guárdalo en disco por session id.
const sessions = new Map();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/chat") {
      let body = "";
      for await (const c of req) body += c;
      const { session = "default", message } = JSON.parse(body || "{}");
      if (!message) return json(res, 400, { error: "message requerido" });
      const history = sessions.get(session) || [];
      const out = await turn({ history, userText: message });
      sessions.set(session, out.history);
      return json(res, 200, { text: out.text, trace: out.trace });
    }
    if (req.method === "POST" && req.url === "/api/reset") {
      sessions.clear();
      return json(res, 200, { ok: true });
    }
    // estáticos: / -> app/index.html, /docs/... -> docs/...
    const clean = decodeURIComponent(req.url.split("?")[0]);
    const file = clean === "/" ? "app/index.html" : clean.startsWith("/docs/") ? clean.slice(1) : "app" + clean;
    const abs = path.resolve(ROOT, file);
    const allowed = [path.join(ROOT, "app") + path.sep, path.join(ROOT, "docs") + path.sep];
    if (!allowed.some((d) => abs.startsWith(d))) return json(res, 403, { error: "no" });
    const data = await fs.readFile(abs);
    res.writeHead(200, { "content-type": TYPES[path.extname(abs)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    json(res, e.code === "ENOENT" ? 404 : 500, { error: e.message });
  }
});

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, () => {
  console.log(`ADA Harness en http://localhost:${PORT}`);
  console.log(`Explicador en http://localhost:${PORT}/docs/Anatom%C3%ADa%20de%20un%20Agente.html`);
});
