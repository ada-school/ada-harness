// Integración: el servidor real en un puerto libre, Ollama falso por HTTP y, para el cambio de
// proveedor, Gemini simulado. Recorre lo mismo que hace el navegador.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../../src/server.js";
import { detectar } from "../../src/providers/ollama.js";
import { startFakeOllama, modelo, respuestaChat } from "../helpers/fake-ollama.js";
import { tempWorkspace, cleanEnv } from "../helpers/workspace.js";

cleanEnv();
let base, servidor, fake, ws;
before(async () => {
  fake = await startFakeOllama();
  process.env.OLLAMA_HOST = fake.host;
  fake.state.tags = [modelo("qwen3:8b", ["completion", "tools"])];
  await detectar({ forzar: true });
  ws = await tempWorkspace();
  servidor = createServer();
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok(null)));
  const { port } = /** @type {import("node:net").AddressInfo} */ (servidor.address());
  base = `http://127.0.0.1:${port}`;
});
after(async () => {
  await new Promise((ok) => servidor.close(() => ok(null)));
  await fake.close();
  await ws.cleanup();
});

const post = (ruta, body, crudo = false) =>
  fetch(base + ruta, { method: "POST", headers: { "content-type": "application/json" }, body: crudo ? body : JSON.stringify(body) });

test("sirve el chat, sus módulos y el explicador; nada más", async () => {
  const index = await fetch(base + "/");
  assert.equal(index.status, 200);
  assert.match(await index.text(), /<script type="module" src="\/js\/main.js">/);
  for (const [ruta, tipo] of [["/js/main.js", "text/javascript"], ["/styles.css", "text/css"], ["/docs/Anatom%C3%ADa%20de%20un%20Agente.html", "text/html"]]) {
    const r = await fetch(base + ruta);
    assert.equal(r.status, 200, ruta);
    assert.match(r.headers.get("content-type") || "", new RegExp(tipo), ruta);
  }
  assert.equal((await fetch(base + "/docs/..%2F.env.example")).status, 403);
  assert.equal((await fetch(base + "/no-existe.js")).status, 404);
});

test("GET /api/providers: sin claves, Ollama queda por defecto con su modelo", async () => {
  const { providers } = await (await fetch(base + "/api/providers")).json();
  const o = providers.find((p) => p.name === "ollama");
  assert.equal(o.default, true);
  assert.deepEqual(o.status.models.map((m) => m.name), ["qwen3:8b"]);
  assert.equal(providers.find((p) => p.name === "anthropic").configured, false);
});

test("POST /api/chat: errores de entrada con 400", async () => {
  assert.equal((await post("/api/chat", "{no es json", true)).status, 400);
  const r = await post("/api/chat", { session: "x" });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "message requerido" });
});

test("POST /api/chat: un turno con herramienta y la sesión recuerda el anterior", async () => {
  fake.state.pedidos = [];
  fake.state.chats = [
    respuestaChat({ tool_calls: [{ function: { name: "write_file", arguments: { path: "nota.txt", content: "hola" } } }] }),
    respuestaChat({ content: "Escribí nota.txt" }),
    respuestaChat({ content: "Sí, la escribí hace un momento." }),
  ];
  const r1 = await (await post("/api/chat", { session: "s1", message: "escribe nota.txt", provider: "ollama" })).json();
  assert.equal(r1.text, "Escribí nota.txt");
  assert.equal(r1.reset, false);
  assert.equal(r1.trace.provider, "ollama");
  assert.equal(r1.trace.budget, 16384);
  assert.equal(r1.trace.tools[0].name, "write_file");

  const r2 = await (await post("/api/chat", { session: "s1", message: "¿la escribiste?", provider: "ollama" })).json();
  assert.equal(r2.text, "Sí, la escribí hace un momento.");
  const ultimo = fake.state.pedidos.at(-1).messages;
  assert.deepEqual(ultimo.map((m) => m.role), ["system", "user", "assistant", "tool", "assistant", "user"], "el segundo turno lleva el primero completo");
});

test("POST /api/chat: cambiar de proveedor empieza una conversación nueva", async () => {
  process.env.GEMINI_API_KEY = "clave-de-prueba";
  const original = globalThis.fetch;
  /** @type {any[]} */
  const pedidosGemini = [];
  globalThis.fetch = /** @type {any} */ (async (url, opt) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return original(url, opt);
    pedidosGemini.push(JSON.parse(opt.body));
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { role: "model", parts: [{ text: "hola desde Gemini" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10 } }) };
  });
  try {
    fake.state.chats = [respuestaChat({ content: "hola desde Ollama" })];
    await post("/api/chat", { session: "s2", message: "uno", provider: "ollama" });
    const r = await (await post("/api/chat", { session: "s2", message: "dos", provider: "gemini" })).json();
    assert.equal(r.text, "hola desde Gemini");
    assert.equal(r.reset, true);
    assert.equal(pedidosGemini[0].contents.length, 1, "Gemini no recibe el historial de Ollama");
  } finally {
    globalThis.fetch = original;
    delete process.env.GEMINI_API_KEY;
  }
});

test("POST /api/chat: un proveedor sin clave responde 500 con el motivo", async () => {
  const r = await post("/api/chat", { session: "s3", message: "hola", provider: "anthropic" });
  assert.equal(r.status, 500);
  assert.match((await r.json()).error, /Falta ANTHROPIC_API_KEY/);
});

test("POST /api/reset", async () => {
  assert.deepEqual(await (await post("/api/reset", {})).json(), { ok: true });
});
