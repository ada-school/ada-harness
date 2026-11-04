// Integration: the real server on a free port, fake Ollama over HTTP, and, for the provider
// change, simulated Gemini. It walks the same path the browser does.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { tomarEventos, aplicarEvento } from "../../app/js/conversacion.js";
import { createServer } from "../../dist/src/server.js";
import { detectar } from "../../dist/src/providers/ollama.js";
import { startFakeOllama, modelo, respuestaChat } from "../helpers/fake-ollama.js";
import { tempWorkspace, cleanEnv } from "../helpers/workspace.js";

cleanEnv();
let base, servidor, fake, ws, sesionesDir;
before(async () => {
  fake = await startFakeOllama();
  process.env.OLLAMA_HOST = fake.host;
  fake.state.tags = [modelo("qwen3:8b", ["completion", "tools"])];
  await detectar({ forzar: true });
  ws = await tempWorkspace();
  sesionesDir = await mkdtemp(path.join(os.tmpdir(), "ada-sesiones-"));
  process.env.ADA_SESSIONS = sesionesDir;
  servidor = createServer();
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok(null)));
  const { port } = /** @type {import("node:net").AddressInfo} */ (servidor.address());
  base = `http://127.0.0.1:${port}`;
});
after(async () => {
  await new Promise((ok) => servidor.close(() => ok(null)));
  await fake.close();
  await ws.cleanup();
  delete process.env.ADA_SESSIONS;
  await rm(sesionesDir, { recursive: true, force: true });
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
  const malo = await post("/api/chat", "{no es json", true);
  assert.equal(malo.status, 400);
  assert.deepEqual(await malo.json(), { error: "Invalid JSON" });
  const r = await post("/api/chat", { session: "x" });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "message is required" });
});

test("CU-01.5 POST /api/chat: un turno con herramienta, y el segundo turno lleva el primero completo", async () => {
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

test("CU-02.6 POST /api/chat: cambiar de proveedor empieza una conversación nueva", async () => {
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

test("CU-02.6 POST /api/chat: otro modelo del mismo proveedor también empieza una conversación nueva", async () => {
  fake.state.chats = [respuestaChat({ content: "uno" }), respuestaChat({ content: "dos" })];
  await post("/api/chat", { session: "s5", message: "primero", provider: "ollama", model: "qwen3:8b" });
  const r = await (await post("/api/chat", { session: "s5", message: "segundo", provider: "ollama", model: "llama3.1:8b" })).json();
  assert.equal(r.reset, true);
  assert.deepEqual(fake.state.pedidos.at(-1).messages.map((m) => m.role), ["system", "user"]);
});

test("seguridad: otra página no puede correr un turno, ni con texto plano ni desde otro origen", async () => {
  const antes = fake.state.pedidos.length;
  const plano = await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ message: "corre algo" }) });
  assert.equal(plano.status, 415);
  const ajeno = await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json", origin: "https://sitio-cualquiera.example" }, body: JSON.stringify({ message: "corre algo" }) });
  assert.equal(ajeno.status, 403);
  assert.equal(fake.state.pedidos.length, antes, "el modelo no recibió nada");
});

test("CU-01.4 POST /api/chat: un proveedor sin clave responde 500 con el motivo", async () => {
  const r = await post("/api/chat", { session: "s3", message: "hola", provider: "anthropic" });
  assert.equal(r.status, 500);
  assert.match((await r.json()).error, /Missing ANTHROPIC_API_KEY/);
});

test("CU-01.8 POST /api/chat: la respuesta llega en trozos y el turno siguiente conserva el texto", async () => {
  fake.state.chats = [respuestaChat({ content: "hola" }), respuestaChat({ content: "sigo" })];
  const res = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ session: "sse", message: "di hola", provider: "ollama" }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/event-stream/);
  const { events, rest } = tomarEventos(await res.text());
  assert.equal(rest, "");
  assert.deepEqual(events.filter((e) => e.event === "delta").map((e) => e.data.text), ["ho", "la"]);
  /** @type {{ texto: string, listo: boolean, trace: any, error: string | null, reset: boolean }} */
  let estado = { texto: "", listo: false, trace: null, error: null, reset: false };
  for (const evento of events) estado = aplicarEvento(estado, evento);
  assert.equal(estado.texto, "hola");
  assert.equal(estado.listo, true);
  assert.ok(estado.trace && estado.trace.calls >= 1);
  const r2 = await (await post("/api/chat", { session: "sse", message: "sigue", provider: "ollama" })).json();
  assert.equal(r2.text, "sigo");
  assert.equal(r2.reset, false);
  const previo = fake.state.pedidos.at(-1).messages.find((m) => m.role === "assistant");
  assert.equal(previo.content, "hola");
});

test("CU-04.1 POST /api/reset: el siguiente mensaje llega al modelo sin turnos anteriores", async () => {
  fake.state.chats = [respuestaChat({ content: "uno" }), respuestaChat({ content: "dos" })];
  await post("/api/chat", { session: "s4", message: "primero", provider: "ollama" });
  assert.deepEqual(await (await post("/api/reset", {})).json(), { ok: true });
  await post("/api/chat", { session: "s4", message: "segundo", provider: "ollama" });
  assert.deepEqual(fake.state.pedidos.at(-1).messages.map((m) => m.role), ["system", "user"]);
});

test("CU-01.9 al reiniciar el servidor, el siguiente mensaje lleva el turno anterior", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ada-sesiones-"));
  const antes = process.env.ADA_SESSIONS;
  process.env.ADA_SESSIONS = dir;
  /** @type {import("node:http").Server[]} */
  const abiertos = [];
  const escuchar = (/** @type {import("node:http").Server} */ s) => new Promise((ok) => {
    s.listen(0, "127.0.0.1", () => ok(null));
  });
  try {
    const a = createServer();
    abiertos.push(a);
    await escuchar(a);
    const puertoA = /** @type {import("node:net").AddressInfo} */ (a.address()).port;
    fake.state.chats = [respuestaChat({ content: "uno" }), respuestaChat({ content: "dos" })];
    await fetch(`http://127.0.0.1:${puertoA}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: "persist", message: "primero", provider: "ollama" }),
    });
    await new Promise((ok) => a.close(() => ok(null)));
    const b = createServer();
    abiertos.push(b);
    await escuchar(b);
    const puertoB = /** @type {import("node:net").AddressInfo} */ (b.address()).port;
    await fetch(`http://127.0.0.1:${puertoB}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: "persist", message: "segundo", provider: "ollama" }),
    });
    const previo = fake.state.pedidos.at(-1).messages.find((m) => m.role === "assistant");
    assert.equal(previo.content, "uno");
    await new Promise((ok) => b.close(() => ok(null)));
  } finally {
    if (antes === undefined) delete process.env.ADA_SESSIONS; else process.env.ADA_SESSIONS = antes;
    await Promise.all(abiertos.map((s) => new Promise((ok) => s.close(() => ok(null)))));
    await rm(dir, { recursive: true, force: true });
  }
});
