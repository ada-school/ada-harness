// Adaptador de Ollama contra un servidor HTTP falso que imita su API (/api/tags, /api/show,
// /api/chat). Sin Ollama instalado y sin red externa.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ollama, detectar, desdeOllama, haciaOllama } from "../../src/providers/ollama.js";
import { resolveProvider, listProviders } from "../../src/providers/index.js";
import { turn } from "../../src/harness.js";
import { startFakeOllama, modelo, respuestaChat as chat } from "../helpers/fake-ollama.js";
import { tempWorkspace, cleanEnv } from "../helpers/workspace.js";

cleanEnv();
/** @type {Awaited<ReturnType<typeof startFakeOllama>>} */
let fake;
/** @type {Awaited<ReturnType<typeof tempWorkspace>>} */
let ws;
let falso;
before(async () => {
  fake = await startFakeOllama();
  falso = fake.state;
  // sin esquema, como lo escribe la gente en OLLAMA_HOST: el adaptador lo normaliza
  process.env.OLLAMA_HOST = fake.host;
  ws = await tempWorkspace();
});
after(async () => { await fake.close(); await ws.cleanup(); });

test("detecta Ollama, habilita solo modelos con herramientas y prefiere uno local", async () => {
  falso.tags = [
    modelo("gemma4:cloud", ["completion", "tools"], { remote_host: "https://ollama.com:443" }),
    modelo("llava:7b", ["completion", "vision"]),
    modelo("qwen3:8b", ["completion", "tools", "thinking"]),
  ];
  await detectar({ forzar: true });
  assert.equal(ollama.configured(), true);
  assert.equal(ollama.model(), "qwen3:8b", "local antes que nube");
  const st = ollama.status();
  assert.equal(st.detected, true);
  assert.deepEqual(st.models.map((m) => [m.name, m.tools, m.remote]), [["gemma4:cloud", true, true], ["llava:7b", false, false], ["qwen3:8b", true, false]]);
  // sin claves de Claude ni Gemini, el harness elige Ollama solo
  assert.equal((await resolveProvider()).name, "ollama");
  const lista = await listProviders();
  assert.equal(lista.find((p) => p.default)?.name, "ollama");
});

test("versiones viejas sin capabilities en /api/tags: consulta /api/show y respeta su contexto", async () => {
  falso.tags = [modelo("llama3.1:8b")];
  falso.show = { "llama3.1:8b": { capabilities: ["completion", "tools"], model_info: { "llama.context_length": 8192 } } };
  await detectar({ forzar: true });
  assert.equal(ollama.model(), "llama3.1:8b");
  assert.equal(ollama.contextWindow("llama3.1:8b"), 8192, "min(num_ctx 16384, contexto del modelo 8192)");
});

test("Ollama instalado pero sin modelos con herramientas: lo dice", async () => {
  falso.tags = [modelo("llava:7b", ["completion", "vision"])];
  await detectar({ forzar: true });
  assert.equal(ollama.configured(), false);
  assert.match(ollama.status().reason, /ningún modelo instalado usa herramientas/);
});

test("sin Ollama corriendo: falla rápido y explica dónde buscó", async () => {
  const antes = process.env.OLLAMA_HOST;
  process.env.OLLAMA_HOST = "http://127.0.0.1:9"; // puerto cerrado
  try {
    const t0 = Date.now();
    await detectar({ forzar: true });
    assert.ok(Date.now() - t0 < 1500, "la detección no debe frenar el arranque");
    assert.equal(ollama.configured(), false);
    assert.match(ollama.status().reason, /no detectado en http:\/\/127\.0\.0\.1:9/);
  } finally { process.env.OLLAMA_HOST = antes; await detectar({ forzar: true }); }
});

test("loop completo: tool_calls sin id, resultado como role tool y num_ctx fijado", async () => {
  falso.tags = [modelo("qwen3:8b", ["completion", "tools"])];
  await detectar({ forzar: true });
  falso.pedidos = [];
  falso.chats = [
    chat({ tool_calls: [{ function: { index: 0, name: "read_file", arguments: { path: "/AGENTS.md" } } }] }),
    chat({ content: "AGENTS.md dice que el proyecto no tiene dependencias." }),
  ];
  const out = await turn({ history: [], userText: "lee AGENTS.md", provider: "ollama" });
  assert.equal(out.text, "AGENTS.md dice que el proyecto no tiene dependencias.");
  assert.equal(out.trace.provider, "ollama");
  assert.equal(out.trace.model, "qwen3:8b");
  assert.equal(out.trace.budget, 16384, "el presupuesto sigue a la ventana real, no a routing.json");
  assert.equal(out.trace.lastContext?.usage.input_tokens, 900);

  const [p1, p2] = falso.pedidos;
  assert.equal(p1.stream, false);
  assert.equal(p1.options.num_ctx, 16384);
  assert.equal(p1.messages[0].role, "system");
  assert.ok(p1.messages[0].content.includes("<projectGuide>"));
  assert.deepEqual(Object.keys(p1.tools[0]), ["type", "function"]);
  assert.deepEqual(p2.messages.map((m) => m.role), ["system", "user", "assistant", "tool"]);
  assert.deepEqual(p2.messages[2].tool_calls, [{ function: { index: 0, name: "read_file", arguments: { path: "/AGENTS.md" } } }], "sin id inventado");
  assert.equal(p2.messages[3].tool_name, "read_file");
  assert.equal("tool_call_id" in p2.messages[3], false);
  assert.ok(p2.messages[3].content.includes("AGENTS.md"));
});

test("con id en tool_calls, el resultado vuelve con tool_call_id; el modelo elegido se respeta", async () => {
  falso.tags = [modelo("qwen3:8b", ["completion", "tools"]), modelo("llama3.1:8b", ["completion", "tools"])];
  await detectar({ forzar: true });
  falso.pedidos = [];
  falso.chats = [
    chat({ tool_calls: [{ id: "call_7", function: { index: 0, name: "list_dir", arguments: { path: "/" } } }] }),
    chat({ content: "listo" }),
  ];
  const out = await turn({ history: [], userText: "lista", provider: "ollama", model: "llama3.1:8b" });
  assert.equal(out.trace.model, "llama3.1:8b");
  assert.equal(falso.pedidos[0].model, "llama3.1:8b");
  const tool = falso.pedidos[1].messages.find((m) => m.role === "tool");
  assert.equal(tool.tool_call_id, "call_7");
  assert.equal(falso.pedidos[1].messages.find((m) => m.role === "assistant").tool_calls[0].id, "call_7");
});

test("subagente: mismo modelo por defecto, para no cargar un segundo modelo en memoria", async () => {
  falso.tags = [modelo("qwen3:8b", ["completion", "tools"])];
  await detectar({ forzar: true });
  falso.pedidos = [];
  falso.chats = [
    chat({ tool_calls: [{ function: { index: 0, name: "spawn_agent", arguments: { agent: "researcher", task: "lista el repo" } } }] }),
    chat({ content: "informe: 21 archivos" }),
    chat({ content: "El investigador encontró 21 archivos." }),
  ];
  await turn({ history: [], userText: "investiga", provider: "ollama" });
  assert.equal(falso.pedidos[1].model, "qwen3:8b");
  assert.deepEqual(falso.pedidos[1].messages.map((m) => m.role), ["system", "user"], "el subagente arranca vacío");
});

test("razonamiento: se separa del texto y vuelve como thinking", () => {
  const r = desdeOllama(chat({ content: "<think>busco el archivo</think>Voy a leerlo.", tool_calls: [{ function: { name: "read_file", arguments: '{"path":"a.js"}' } }] }));
  const [texto, llamada] = r.content;
  assert.ok(texto.type === "text" && llamada.type === "tool_use");
  assert.equal(texto.text, "Voy a leerlo.");
  assert.deepEqual(llamada.input, { path: "a.js" }, "arguments en string también se aceptan");
  const msgs = haciaOllama("s", [{ role: "user", content: "x" }, { role: "assistant", content: r.content }]);
  assert.equal(msgs[2].thinking, "busco el archivo");
});

test("ventana chica: piso de 8192 y resultados grandes van a disco antes", async () => {
  process.env.ADA_OLLAMA_NUM_CTX = "1000";
  const grande = path.join(ws.dir, "grande-prueba.txt");
  await fs.writeFile(grande, "linea de prueba\n".repeat(700)); // ~2.800 tokens: bajo 6k, sobre 8192 × 0.25
  try {
    falso.tags = [modelo("qwen3:8b", ["completion", "tools"])];
    await detectar({ forzar: true });
    assert.equal(ollama.contextWindow("qwen3:8b"), 8192);
    falso.pedidos = [];
    falso.chats = [
      chat({ tool_calls: [{ function: { name: "read_file", arguments: { path: "grande-prueba.txt" } } }] }),
      chat({ content: "leído" }),
    ];
    await turn({ history: [], userText: "lee el grande", provider: "ollama" });
    const tool = falso.pedidos[1].messages.find((m) => m.role === "tool");
    assert.match(tool.content, /^\[Resultado largo/);
  } finally {
    delete process.env.ADA_OLLAMA_NUM_CTX;
    await fs.rm(grande, { force: true });
  }
});
