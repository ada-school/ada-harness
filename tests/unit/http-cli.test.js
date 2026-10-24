// Piezas chicas de la capa de entrada: qué archivos sirve el servidor y cómo lee la terminal.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveStatic } from "../../src/http/static.js";
import { createSessionStore, peticionPermitida } from "../../src/http/api.js";
import { parseArgs } from "../../src/cli.js";
import { paths, listenHost } from "../../src/config.js";

test("estáticos: el chat, sus módulos y la documentación", () => {
  assert.equal(resolveStatic("/"), path.join(paths.app, "index.html"));
  assert.equal(resolveStatic("/js/main.js?v=2"), path.join(paths.app, "js", "main.js"));
  assert.equal(resolveStatic("/docs/Anatom%C3%ADa%20de%20un%20Agente.html"), path.join(paths.docs, "Anatomía de un Agente.html"));
});

test("estáticos: nada fuera de app/ y docs/, tampoco con ../ codificado", () => {
  for (const url of ["/../.env", "/docs/..%2F.env.example", "/docs/../src/harness.js", "/%2e%2e/package.json", "/%E0%A4%A"]) {
    assert.equal(resolveStatic(url), null, url);
  }
});

test("CU-02.6 sesiones: el historial sigue con el mismo modelo y se reinicia al cambiar de modelo o de proveedor", () => {
  const s = createSessionStore();
  assert.deepEqual(s.get("a", "ollama|qwen3:8b"), { history: [], reset: false });
  s.set("a", "ollama|qwen3:8b", [{ role: "user", content: "hola" }]);
  assert.equal(s.get("a", "ollama|qwen3:8b").history.length, 1);
  assert.deepEqual(s.get("a", "ollama|llama3.1:8b"), { history: [], reset: true }, "otro modelo del mismo proveedor");
  assert.deepEqual(s.get("a", "gemini|"), { history: [], reset: true });
  s.clear();
  assert.equal(s.size, 0);
});

/** Corre `fn` con ADA_HOST fijado, y lo deja como estaba. */
function conHost(/** @type {string | undefined} */ valor, /** @type {() => void} */ fn) {
  const antes = process.env.ADA_HOST;
  if (valor === undefined) delete process.env.ADA_HOST; else process.env.ADA_HOST = valor;
  try { fn(); } finally { if (antes === undefined) delete process.env.ADA_HOST; else process.env.ADA_HOST = antes; }
}
const pedido = (/** @type {string} */ method, /** @type {Record<string, string>} */ headers) => ({ method, headers });
/** El estado del rechazo; 0 si el pedido fue aceptado. */
const estado = (/** @type {ReturnType<typeof peticionPermitida>} */ r) => (r.ok ? 0 : r.estado);
const json = { "content-type": "application/json" };

test("servidor: escucha solo en esta máquina, salvo que ADA_HOST diga otra cosa", () => {
  conHost(undefined, () => assert.equal(listenHost(), "127.0.0.1"));
  conHost("0.0.0.0", () => assert.equal(listenHost(), "0.0.0.0"));
});

test("API: solo el propio chat corre turnos; otra página abierta en el navegador no", () => conHost(undefined, () => {
  const local = { host: "localhost:3000" };
  assert.deepEqual(peticionPermitida(pedido("GET", local)), { ok: true });
  assert.deepEqual(peticionPermitida(pedido("POST", { ...local, ...json, origin: "http://localhost:3000" })), { ok: true });
  assert.deepEqual(peticionPermitida(pedido("POST", { ...local, "content-type": "application/json; charset=utf-8" })), { ok: true }, "curl no manda Origin");
  assert.ok(peticionPermitida(pedido("POST", { host: "127.0.0.1:3000", ...json, origin: "http://127.0.0.1:3000" })).ok);
  assert.ok(peticionPermitida(pedido("GET", { host: "[::1]:3000" })).ok);
  assert.equal(estado(peticionPermitida(pedido("POST", { ...local, "content-type": "text/plain" }))), 415, "un fetch simple o un formulario de otra página");
  assert.equal(estado(peticionPermitida(pedido("POST", local))), 415, "sin tipo de contenido");
  assert.equal(estado(peticionPermitida(pedido("POST", { ...local, ...json, origin: "https://sitio-cualquiera.example" }))), 403);
  assert.equal(estado(peticionPermitida(pedido("POST", { ...local, ...json, origin: "null" }))), 403, "un archivo abierto con doble clic o un iframe aislado");
  assert.equal(estado(peticionPermitida(pedido("GET", { host: "sitio-cualquiera.example:3000" }))), 403, "DNS rebinding");
}));

test("API: con ADA_HOST abierto a la red se acepta el nombre de la máquina, pero no otro origen", () => conHost("0.0.0.0", () => {
  const lan = { host: "192.168.1.20:3000" };
  assert.ok(peticionPermitida(pedido("GET", lan)).ok);
  assert.ok(peticionPermitida(pedido("POST", { ...lan, ...json, origin: "http://192.168.1.20:3000" })).ok);
  assert.equal(estado(peticionPermitida(pedido("POST", { ...lan, ...json, origin: "https://sitio-cualquiera.example" }))), 403);
}));

test("terminal: proveedor, modelo y mensaje", () => {
  assert.deepEqual(parseArgs(["--ollama", "--model=qwen3:8b", "lee", "AGENTS.md"]), { provider: "ollama", model: "qwen3:8b", message: "lee AGENTS.md", capas: false });
  assert.deepEqual(parseArgs(["hola"]), { provider: undefined, model: undefined, message: "hola", capas: false });
  assert.match(parseArgs([]).message, /Lista los archivos/);
});

test("terminal: --capas pide el peso de las capas, no un turno", () => {
  assert.equal(parseArgs(["--capas"]).capas, true);
  assert.equal(parseArgs(["--capas"]).provider, undefined, "--capas no es un proveedor");
});
