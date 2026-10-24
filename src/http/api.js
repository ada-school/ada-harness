// API del chat.
//   GET  /api/providers  proveedores disponibles: claves, y Ollama detectado con sus modelos
//   POST /api/chat       { session, message, provider?, model? }  ->  { text, trace, reset }
//   POST /api/reset      borra todas las sesiones

import { turn } from "../harness.js";
import { resolveProvider, listProviders } from "../providers/index.js";
import { abiertoALaRed } from "../config.js";

const LOCALES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * ¿Este pedido viene del propio chat? (decisión 0006). Sin esta revisión, cualquier página abierta
 * en tu navegador podría mandar un POST a localhost y correr herramientas en tu máquina.
 * - Host: solo nombres locales, salvo que ADA_HOST abra el servidor a la red (frena el DNS rebinding).
 * - POST: solo application/json, que el navegador no deja mandar a otro origen sin permiso (CORS).
 * - Origin, si viene: el mismo del servidor.
 * @param {{ method?: string, headers: Record<string, string | string[] | undefined> }} req
 * @returns {{ ok: true } | { ok: false, estado: number, error: string }}
 */
export function peticionPermitida({ method, headers }) {
  const host = String(headers.host || "");
  if (!abiertoALaRed() && !LOCALES.includes(host.replace(/:\d+$/, ""))) return { ok: false, estado: 403, error: "host no permitido" };
  if (method !== "POST") return { ok: true };
  if (!/^application\/json\b/i.test(String(headers["content-type"] || ""))) return { ok: false, estado: 415, error: "se espera content-type application/json" };
  if (headers.origin !== undefined && headers.origin !== `http://${host}`) return { ok: false, estado: 403, error: "origen no permitido" };
  return { ok: true };
}

/**
 * Historial por sesión, en memoria del proceso. Cambiar de modelo o de proveedor empieza una
 * conversación nueva (CU-02.6): cada API devuelve firmas e ids que solo entiende ella.
 */
export function createSessionStore() {
  /** @type {Map<string, { clave: string, history: import("../types.js").Message[] }>} */
  const sesiones = new Map();
  return {
    /** @param {string} id @param {string} clave "proveedor|modelo" */
    get(id, clave) {
      const previa = sesiones.get(id);
      const reset = Boolean(previa && previa.clave !== clave);
      return { history: previa && !reset ? previa.history : [], reset };
    },
    /** @param {string} id @param {string} clave @param {import("../types.js").Message[]} history */
    set(id, clave, history) { sesiones.set(id, { clave, history }); },
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
      const clave = `${prov.name}|${model || ""}`;
      const { history, reset } = sessions.get(session, clave);
      const out = await turn({ history, userText: message, provider: prov.name, model });
      sessions.set(session, clave, out.history);
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
    const permiso = peticionPermitida(req);
    if (!permiso.ok) [status, body] = [permiso.estado, { error: permiso.error }];
    else {
      try { [status, body] = await ruta(req); }
      catch (e) { [status, body] = [e.status || 500, { error: e.message }]; }
    }
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
    return true;
  };
}
