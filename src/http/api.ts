// Edit src/http/api.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Chat API.
//   GET  /api/providers  available providers: keys, and detected Ollama with its models
//   POST /api/chat       { session, message, provider?, model? }
//                        Accept: application/json (default) -> { text, trace, reset }
//                        Accept: text/event-stream -> delta events, then done
//   POST /api/reset      forgets every session

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { turn } from "../harness.js";
import { resolveProvider, listProviders } from "../providers/index.js";
import { abiertoALaRed, ROOT } from "../config.js";
import { text } from "../text.js";
import type { Message } from "../types.js";

const LOCALES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Does this request come from the chat itself? (decision 0006). Without this check, any page
 * open in the browser could POST to localhost and run tools on this machine.
 * - Host: local names only, unless ADA_HOST opens the server to the network (stops DNS rebinding).
 * - POST: application/json only, which the browser will not send to another origin without permission (CORS).
 * - Origin, if present: the same as the server.
 * @param {{ method?: string, headers: Record<string, string | string[] | undefined> }} req
 * @returns {{ ok: true } | { ok: false, estado: number, error: string }}
 */
export function peticionPermitida(
  { method, headers }: { method?: string; headers: Record<string, string | string[] | undefined> },
): { ok: true } | { ok: false; estado: number; error: string } {
  const host = String(headers.host || "");
  if (!abiertoALaRed() && !LOCALES.includes(host.replace(/:\d+$/, ""))) return { ok: false, estado: 403, error: text("hostDenied") };
  if (method !== "POST") return { ok: true };
  if (!/^application\/json\b/i.test(String(headers["content-type"] || ""))) return { ok: false, estado: 415, error: text("wantsJson") };
  if (headers.origin !== undefined && headers.origin !== `http://${host}`) return { ok: false, estado: 403, error: text("originDenied") };
  return { ok: true };
}

type SesionGuardada = { clave: string; history: Message[] };

/**
 * One JSON file for every session. A missing or broken file is an empty store.
 * @param {string} file
 * @returns {Record<string, SesionGuardada>}
 */
function leerSesiones(file: string): Record<string, SesionGuardada> {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data;
  } catch {
    return {};
  }
}

/**
 * History per session, on disk. Changing model or provider starts a new
 * conversation (CU-02.6): each API returns signatures and ids that only it understands.
 * The directory is fixed when the store is created. ADA_SESSIONS moves it; otherwise it is `.sessions/` in the repo.
 * @param {string} [dir]
 */
export function createSessionStore(dir = process.env.ADA_SESSIONS || path.join(ROOT, ".sessions")) {
  const file = path.join(dir, "sessions.json");
  // ponytail: one file rewritten on each set. Split per session if this file gets large.
  return {
    /** @param {string} id @param {string} clave "provider|model" */
    get(id: string, clave: string) {
      const previa = leerSesiones(file)[id];
      const reset = Boolean(previa && previa.clave !== clave);
      const history = previa && !reset && Array.isArray(previa.history) ? previa.history : [];
      return { history, reset };
    },
    /** @param {string} id @param {string} clave @param {import("../types.js").Message[]} history */
    set(id: string, clave: string, history: Message[]) {
      const todas = leerSesiones(file);
      todas[id] = { clave, history };
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify(todas));
    },
    clear() { rmSync(file, { force: true }); },
    get size() { return Object.keys(leerSesiones(file)).length; },
  };
}

/** @param {import("node:http").IncomingMessage} req */
async function readJson(req: IncomingMessage): Promise<any> {
  let body = "";
  for await (const c of req) body += c;
  try { return JSON.parse(body || "{}"); } catch { throw Object.assign(new Error(text("invalidJson")), { status: 400 }); }
}

/**
 * Returns a handler for /api/*, or null if the route is not part of the API.
 * @param {ReturnType<typeof createSessionStore>} sessions
 */
export function createApi(sessions: ReturnType<typeof createSessionStore>) {
  /** @type {Record<string, (req: import("node:http").IncomingMessage) => Promise<[number, any]>>} */
  const rutas: Record<string, (req: IncomingMessage) => Promise<[number, any]>> = {
    "GET /api/providers": async () => [200, { providers: await listProviders() }],

    "POST /api/chat": async (req) => {
      const { session = "default", message, provider, model } = await readJson(req);
      if (!message) return [400, { error: text("messageRequired") }];
      const prov = await resolveProvider(provider, model);
      const clave = `${prov.name}|${model || ""}`;
      const { history, reset } = sessions.get(session, clave);
      const out = await turn({ history, userText: message, provider: prov.name, model });
      sessions.set(session, clave, out.history);
      return [200, { text: out.text, trace: out.trace, reset }];
    },

    "POST /api/reset": async () => { sessions.clear(); return [200, { ok: true }]; },
  };

  /** Writes the turn as Server-Sent Events. A bad request still answers with JSON, before the stream starts. */
  async function chatStream(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let input: any;
    try { input = await readJson(req); }
    catch (e) {
      res.writeHead(e.status || 400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
    if (!input.message) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: text("messageRequired") }));
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const session = input.session || "default";
      const prov = await resolveProvider(input.provider, input.model);
      const clave = `${prov.name}|${input.model || ""}`;
      const { history, reset } = sessions.get(session, clave);
      const out = await turn({
        history,
        userText: input.message,
        provider: prov.name,
        model: input.model,
        onText: (delta) => send("delta", { text: delta }),
      });
      sessions.set(session, clave, out.history);
      send("done", { text: out.text, trace: out.trace, reset });
    } catch (e) {
      send("error", { error: e instanceof Error ? e.message : String(e) });
    }
    res.end();
  }

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = (req.url || "").split("?")[0];
    const ruta = rutas[`${req.method} ${path}`];
    if (!ruta) return false;
    const permiso = peticionPermitida(req);
    if (!permiso.ok) {
      res.writeHead(permiso.estado, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: permiso.error }));
      return true;
    }
    if (req.method === "POST" && path === "/api/chat" && /text\/event-stream/i.test(String(req.headers.accept || ""))) {
      await chatStream(req, res);
      return true;
    }
    let status: number;
    let body: any;
    try { [status, body] = await ruta(req); }
    catch (e) { [status, body] = [e.status || 500, { error: e.message }]; }
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
    return true;
  };
}
