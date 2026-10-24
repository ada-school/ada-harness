// Servidor mínimo: conecta la API del chat (src/http/api.js) y los archivos estáticos
// (src/http/static.js). Sin dependencias. Node 18+.

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, port, listenHost, abiertoALaRed } from "./config.js";
import { createApi, createSessionStore } from "./http/api.js";
import { serveStatic } from "./http/static.js";
import { listProviders } from "./providers/index.js";

/** Crea el servidor sin escuchar todavía: las pruebas lo levantan en un puerto libre. */
export function createServer() {
  const api = createApi(createSessionStore());
  return http.createServer(async (req, res) => {
    if (await api(req, res)) return;
    await serveStatic(req, res);
  });
}

/** Resumen de arranque: qué proveedores están listos y qué falta. */
async function informar(puerto) {
  const lista = await listProviders();
  const conClave = lista.filter((p) => p.configured && p.keyEnv).map((p) => `${p.label} (${p.model})`);
  const o = lista.find((p) => p.name === "ollama")?.status;
  const locales = (o?.models || []).filter((m) => m.tools).map((m) => m.name + (m.remote ? " (nube)" : ""));
  console.log(`ADA Harness en http://localhost:${puerto}`);
  console.log(`Con clave: ${conClave.join(", ") || "ninguno"}`);
  console.log(o?.detected
    ? `Ollama en ${o.host}: ${locales.length ? locales.join(", ") : "sin modelos con herramientas (prueba: ollama pull qwen3:8b)"}`
    : `Ollama: ${o?.reason}. Para modelos locales gratis: https://ollama.com/download`);
  if (!lista.some((p) => p.configured)) console.log("Ningún proveedor listo: agrega una clave en .env o corre Ollama con un modelo.");
  console.log(`Explicador en http://localhost:${puerto}/docs/Anatom%C3%ADa%20de%20un%20Agente.html`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  loadEnvFile();
  const puerto = port();
  createServer().listen(puerto, listenHost(), async () => {
    await informar(puerto);
    if (abiertoALaRed()) console.log(`Atención: ADA_HOST=${listenHost()} abre el chat a otras máquinas. Cualquiera en tu red puede correr herramientas en este equipo.`);
  });
}
