// Servidor mínimo: sirve app/ y docs/, y expone la API del chat.
//   GET  /api/providers  proveedores disponibles: claves, y Ollama detectado con sus modelos
//   POST /api/chat       { session, message, provider?, model? }  ->  { text, trace, reset? }
//   POST /api/reset      borra todas las sesiones
// Sin dependencias. Node 18+.

import "./env.js";
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ROOT } from "./context.js";
import { turn } from "./harness.js";
import { resolveProvider, listProviders } from "./providers/index.js";

const PORT = Number(process.env.PORT || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

// Historial por sesión, en memoria del proceso: { provider, history }.
// Cambiar de proveedor empieza una conversación nueva: cada modelo devuelve firmas e ids que
// solo entiende él (las thoughtSignature de Gemini, por ejemplo), y mezclarlos rompe el turno.
const sessions = new Map();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/chat") {
      let body = "";
      for await (const c of req) body += c;
      const { session = "default", message, provider, model } = JSON.parse(body || "{}");
      if (!message) return json(res, 400, { error: "message requerido" });
      const prov = await resolveProvider(provider, model);
      const previa = sessions.get(session);
      const reset = Boolean(previa && previa.provider !== prov.name);
      const history = previa && !reset ? previa.history : [];
      const out = await turn({ history, userText: message, provider: prov.name, model });
      sessions.set(session, { provider: prov.name, history: out.history });
      return json(res, 200, { text: out.text, trace: out.trace, reset });
    }
    if (req.method === "GET" && req.url === "/api/providers") {
      return json(res, 200, { providers: await listProviders() });
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

server.listen(PORT, async () => {
  const lista = await listProviders();
  const conClave = lista.filter((p) => p.configured && p.keyEnv).map((p) => `${p.label} (${p.model})`);
  const o = lista.find((p) => p.name === "ollama")?.status;
  const locales = (o?.models || []).filter((m) => m.tools).map((m) => m.name + (m.remote ? " (nube)" : ""));
  console.log(`ADA Harness en http://localhost:${PORT}`);
  console.log(`Con clave: ${conClave.join(", ") || "ninguno"}`);
  console.log(o?.detected
    ? `Ollama en ${o.host}: ${locales.length ? locales.join(", ") : "sin modelos con herramientas (prueba: ollama pull qwen3:8b)"}`
    : `Ollama: ${o?.reason}. Para modelos locales gratis: https://ollama.com/download`);
  if (!lista.some((p) => p.configured)) console.log("Ningún proveedor listo: agrega una clave en .env o corre Ollama con un modelo.");
  console.log(`Explicador en http://localhost:${PORT}/docs/Anatom%C3%ADa%20de%20un%20Agente.html`);
});
