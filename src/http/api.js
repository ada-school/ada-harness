// API del chat.
//   GET  /api/providers  proveedores disponibles: claves, y Ollama detectado con sus modelos
//   POST /api/chat       { session, message, provider?, model? }  ->  { text, trace, reset }
//   POST /api/reset      borra todas las sesiones

import { turn } from "../harness.js";
import { resolveProvider, listProviders } from "../providers/index.js";

/**
 * Historial por sesión, en memoria del proceso. Cambiar de proveedor empieza una conversación
 * nueva: cada API devuelve firmas e ids que solo entiende ella (las thoughtSignature de Gemini).
 */
export function createSessionStore() {
  /** @type {Map<string, { provider: string, history: import("../types.js").Message[] }>} */
  const sesiones = new Map();
  return {
    /** @param {string} id @param {string} provider */
    get(id, provider) {
      const previa = sesiones.get(id);
      const reset = Boolean(previa && previa.provider !== provider);
      return { history: previa && !reset ? previa.history : [], reset };
    },
    /** @param {string} id @param {string} provider @param {import("../types.js").Message[]} history */
    set(id, provider, history) { sesiones.set(id, { provider, history }); },
    clear() { sesiones.clear(); },
    get size() { return sesiones.size; },
  };
}

/** @param {import("node:http").IncomingMessage} req */
async function readJson(req) {
  let body = "";
  for await (const c of req) body += c;
  try { return JSON.parse(body || "{}"); } catch { throw Object.assign(new Error("JSON inválido"), { status: 400 }); }
}

/**
 * Devuelve un manejador para /api/*, o null si la ruta no es de la API.
 * @param {ReturnType<typeof createSessionStore>} sessions
 */
export function createApi(sessions) {
  /** @type {Record<string, (req: import("node:http").IncomingMessage) => Promise<[number, any]>>} */
  const rutas = {
    "GET /api/providers": async () => [200, { providers: await listProviders() }],

    "POST /api/chat": async (req) => {
      const { session = "default", message, provider, model } = await readJson(req);
      if (!message) return [400, { error: "message requerido" }];
      const prov = await resolveProvider(provider, model);
      const { history, reset } = sessions.get(session, prov.name);
      const out = await turn({ history, userText: message, provider: prov.name, model });
      sessions.set(session, prov.name, out.history);
      return [200, { text: out.text, trace: out.trace, reset }];
    },

    "POST /api/reset": async () => { sessions.clear(); return [200, { ok: true }]; },
  };

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  return async function handle(req, res) {
    const ruta = rutas[`${req.method} ${(req.url || "").split("?")[0]}`];
    if (!ruta) return false;
    let status, body;
    try { [status, body] = await ruta(req); }
    catch (e) { [status, body] = [e.status || 500, { error: e.message }]; }
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
    return true;
  };
}
