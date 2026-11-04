// Small pieces of the entry layer: which files the server serves and how the terminal reads arguments.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStatic } from "../../dist/src/http/static.js";
import { createSessionStore, peticionPermitida } from "../../dist/src/http/api.js";
import { parseArgs, ayuda, main } from "../../dist/src/cli.js";
import { paths, listenHost } from "../../dist/src/config.js";

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
  const dir = mkdtempSync(path.join(os.tmpdir(), "ada-sesiones-"));
  const s = createSessionStore(dir);
  assert.deepEqual(s.get("a", "ollama|qwen3:8b"), { history: [], reset: false });
  s.set("a", "ollama|qwen3:8b", [{ role: "user", content: "hola" }]);
  assert.equal(s.get("a", "ollama|qwen3:8b").history.length, 1);
  assert.deepEqual(s.get("a", "ollama|llama3.1:8b"), { history: [], reset: true }, "otro modelo del mismo proveedor");
  assert.deepEqual(s.get("a", "gemini|"), { history: [], reset: true });
  s.clear();
  assert.equal(s.size, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("sesiones: un proceso nuevo lee el historial que el anterior guardó", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ada-sesiones-"));
  try {
    const primero = createSessionStore(dir);
    primero.set("a", "ollama|qwen3:8b", [{ role: "user", content: "hola" }]);
    const segundo = createSessionStore(dir);
    assert.equal(segundo.get("a", "ollama|qwen3:8b").history[0].content, "hola");
    assert.equal(segundo.get("a", "ollama|llama3.1:8b").reset, true);
    writeFileSync(path.join(dir, "sessions.json"), "no es json");
    assert.equal(createSessionStore(dir).get("a", "ollama|qwen3:8b").history.length, 0);
    segundo.clear();
    assert.equal(createSessionStore(dir).size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Runs `fn` with ADA_HOST set, then puts it back. */
function conHost(/** @type {string | undefined} */ valor, /** @type {() => void} */ fn) {
  const antes = process.env.ADA_HOST;
  if (valor === undefined) delete process.env.ADA_HOST; else process.env.ADA_HOST = valor;
  try { fn(); } finally { if (antes === undefined) delete process.env.ADA_HOST; else process.env.ADA_HOST = antes; }
}
const pedido = (/** @type {string} */ method, /** @type {Record<string, string>} */ headers) => ({ method, headers });
/** The rejection status; 0 if the request was accepted. */
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

/** The full parseArgs shape, so empty fields are not repeated. */
function args(/** @type {Partial<ReturnType<typeof parseArgs>>} */ parcial) {
  return {
    command: "run", provider: undefined, model: undefined, message: "",
    capas: false, help: false, version: false, port: undefined, host: undefined, error: undefined,
    ...parcial,
  };
}

test("terminal: proveedor, modelo y mensaje", () => {
  assert.deepEqual(parseArgs(["--ollama", "--model=qwen3:8b", "lee", "AGENTS.md"]), args({ provider: "ollama", model: "qwen3:8b", message: "lee AGENTS.md" }));
  assert.deepEqual(parseArgs(["hola"]), args({ message: "hola" }));
  assert.match(parseArgs([]).message, /Lista los archivos/);
  assert.equal(parseArgs([]).command, "run");
});

test("terminal: --capas pide el peso de las capas, no un turno", () => {
  assert.equal(parseArgs(["--capas"]).capas, true);
  assert.equal(parseArgs(["--capas"]).command, "capas");
  assert.equal(parseArgs(["capas"]).command, "capas");
  assert.equal(parseArgs(["--capas"]).provider, undefined, "--capas no es un proveedor");
});

test("ADR 0010: el chat y el turno salen del mismo comando", () => {
  assert.equal(parseArgs([], { defaultCommand: "serve" }).command, "serve");
  assert.deepEqual(parseArgs(["serve", "--port", "4000", "--host", "127.0.0.1"]), args({ command: "serve", port: "4000", host: "127.0.0.1" }));
  assert.deepEqual(parseArgs(["run", "--gemini", "hola"]), args({ provider: "gemini", message: "hola" }));
  assert.equal(parseArgs(["-h"]).help, true);
  assert.equal(parseArgs(["-v"]).version, true);
  assert.match(parseArgs(["--no-existe"]).error || "", /unknown option/);
  assert.match(parseArgs(["--ollama", "--gemini", "hola"]).error || "", /one provider/);
  assert.match(parseArgs(["serve", "--port", "no"]).error || "", /port must be a number/);
  assert.match(ayuda(), /ada serve/);
  assert.match(ayuda(), /ada run/);
  assert.match(ayuda(), /ada capas/);
});

test("terminal: el texto sale a medida que llega, y de una vez si el turno no trocea", async () => {
  const original = process.stdout.write;
  /** @type {string[]} */
  const chunks = [];
  process.stdout.write = /** @type {typeof process.stdout.write} */ ((chunk) => { chunks.push(String(chunk)); return true; });
  const traza = { provider: "ollama", model: "m", calls: 1, tools: [], events: [], lastContext: null };
  try {
    await main(["hola"], {
      turn: async ({ onText }) => { onText?.("ho"); onText?.("la"); return { text: "hola", trace: traza }; },
      fixedLayers: async () => [],
      loadRouting: async () => /** @type {any} */ ({}),
      defaultCommand: "run",
    });
    assert.equal(chunks.join(""), "hola\n");
    chunks.length = 0;
    await main(["hola"], {
      turn: async () => ({ text: "entero", trace: traza }),
      fixedLayers: async () => [],
      loadRouting: async () => /** @type {any} */ ({}),
      defaultCommand: "run",
    });
    assert.equal(chunks.join(""), "entero\n");
  } finally {
    process.stdout.write = original;
  }
});
