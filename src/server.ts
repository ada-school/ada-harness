// Edit src/server.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Minimal server: wires the chat API (src/http/api.ts) and the static files
// (src/http/static.ts). No dependencies. Node 18+.

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { port, listenHost, abiertoALaRed } from "./config.js";
import { createApi, createSessionStore } from "./http/api.js";
import { serveStatic } from "./http/static.js";
import { listProviders } from "./providers/index.js";

/** Creates the server without listening yet: tests start it on a free port. */
export function createServer(): http.Server {
  const api = createApi(createSessionStore());
  return http.createServer(async (req, res) => {
    if (await api(req, res)) return;
    await serveStatic(req, res);
  });
}

/** Startup summary: which providers are ready and what is missing. */
async function informar(puerto: number): Promise<void> {
  const lista = await listProviders();
  const conClave = lista.filter((p) => p.configured && p.keyEnv).map((p) => `${p.label} (${p.model})`);
  const o = lista.find((p) => p.name === "ollama")?.status;
  const locales = (o?.models || []).filter((m: any) => m.tools).map((m: any) => m.name + (m.remote ? " (nube)" : ""));
  console.log(`ADA Harness en http://localhost:${puerto}`);
  console.log(`Con clave: ${conClave.join(", ") || "ninguno"}`);
  console.log(o?.detected
    ? `Ollama en ${o.host}: ${locales.length ? locales.join(", ") : "sin modelos con herramientas (prueba: ollama pull qwen3:8b)"}`
    : `Ollama: ${o?.reason}. Para modelos locales gratis: https://ollama.com/download`);
  if (!lista.some((p) => p.configured)) console.log("Ningún proveedor listo: agrega una clave en .env o corre Ollama con un modelo.");
  console.log(`Explicador en http://localhost:${puerto}/docs/Anatom%C3%ADa%20de%20un%20Agente.html`);
}

/** Starts listening. The command already loaded .env and, if they were passed, --port and --host. @returns {import("node:http").Server} */
export function listen(): http.Server {
  const puerto = port();
  const server = createServer();
  server.listen(puerto, listenHost(), async () => {
    await informar(puerto);
    if (abiertoALaRed()) console.log(`Atención: ADA_HOST=${listenHost()} abre el chat a otras máquinas. Cualquiera en tu red puede correr herramientas en este equipo.`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { main } = await import("./cli.js");
  const { turn, fixedLayers } = await import("./harness.js");
  const { loadRouting } = await import("./context.js");
  const argv = process.argv.slice(2);
  const conComando = argv[0] && ["serve", "run", "capas"].includes(argv[0]) ? argv : ["serve", ...argv];
  await main(conComando, { turn, fixedLayers, loadRouting, listen, defaultCommand: "serve" });
}
