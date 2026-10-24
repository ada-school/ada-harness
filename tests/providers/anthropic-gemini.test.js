// Adaptadores de Claude y Gemini, sin red: se simula la API con respuestas en el formato
// documentado. Lo que se prueba es lo que rompe un turno si sale mal: firmas, ids y orden.

import { test } from "node:test";
import assert from "node:assert/strict";
import { haciaGemini, desdeGemini } from "../../src/providers/gemini.js";
import { anthropic } from "../../src/providers/anthropic.js";
import { turn } from "../../src/harness.js";
import { fakeFetch } from "../helpers/fake-fetch.js";

process.env.GEMINI_API_KEY = "clave-de-prueba";
process.env.ANTHROPIC_API_KEY = "clave-de-prueba";

const respuesta = (parts, finishReason = "STOP") => ({
  candidates: [{ content: { role: "model", parts }, finishReason }],
  usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 40, thoughtsTokenCount: 15 },
});

test("gemini: functionCall con finishReason STOP se interpreta como tool_use", () => {
  const r = desdeGemini(respuesta([{ functionCall: { id: "fc-1", name: "read_file", args: { path: "a.js" } }, thoughtSignature: "SIG" }]));
  assert.equal(r.stop_reason, "tool_use");
  assert.deepEqual(r.content[0], { type: "tool_use", id: "fc-1", name: "read_file", input: { path: "a.js" }, _gemini: { thoughtSignature: "SIG" } });
  assert.deepEqual(r.usage, { input_tokens: 1200, output_tokens: 55 });
});

test("gemini: el historial vuelve con id, name y firma en su lugar", () => {
  const contents = haciaGemini([
    { role: "user", content: "lee a.js" },
    { role: "assistant", content: [{ type: "tool_use", id: "fc-1", name: "read_file", input: { path: "a.js" }, _gemini: { thoughtSignature: "SIG" } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "fc-1", content: "contenido" }] },
  ]);
  assert.deepEqual(contents[1], { role: "model", parts: [{ functionCall: { id: "fc-1", name: "read_file", args: { path: "a.js" } }, thoughtSignature: "SIG" }] });
  assert.deepEqual(contents[2], { role: "user", parts: [{ functionResponse: { id: "fc-1", name: "read_file", response: { result: "contenido" } } }] });
});

test("gemini: si el modelo no manda id, no se le envía uno inventado", () => {
  const r = desdeGemini(respuesta([{ functionCall: { name: "list_dir", args: { path: "." } } }]));
  const [llamada] = r.content;
  assert.ok(llamada.type === "tool_use");
  const id = llamada.id;
  assert.match(id, /^ada_/);
  const contents = haciaGemini([
    { role: "user", content: "lista" },
    { role: "assistant", content: r.content },
    { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "x" }] },
  ]);
  assert.equal("id" in contents[1].parts[0].functionCall, false);
  assert.equal("id" in contents[2].parts[0].functionResponse, false);
  assert.equal(contents[2].parts[0].functionResponse.name, "list_dir");
});

test("gemini: fin anómalo sin contenido da un error claro", () => {
  assert.throws(() => desdeGemini(respuesta([], "MISSING_THOUGHT_SIGNATURE")), /MISSING_THOUGHT_SIGNATURE/);
});

test("gemini: loop completo, la firma vuelve intacta en cada paso", async () => {
  const sim = fakeFetch([
    respuesta([{ functionCall: { id: "fc-1", name: "read_file", args: { path: "/AGENTS.md" } }, thoughtSignature: "SIG_A" }]),
    respuesta([{ functionCall: { id: "fc-2", name: "list_dir", args: { path: "/" } }, thoughtSignature: "SIG_B" }]),
    respuesta([{ text: "Listo: leí AGENTS.md y listé el repo.", thoughtSignature: "SIG_C" }]),
  ]);
  try {
    const out = await turn({ history: [], userText: "lee AGENTS.md y lista el repo", provider: "gemini" });
    assert.equal(out.text, "Listo: leí AGENTS.md y listé el repo.");
    assert.equal(out.trace.calls, 3);
    assert.equal(out.trace.provider, "gemini");
    assert.equal(out.trace.lastContext?.usage.input_tokens, 1200);

    const [p1, , p3] = sim.pedidos;
    assert.match(p1.url, /\/models\/gemini-3\.8-flash:generateContent$/);
    assert.equal(p1.headers["x-goog-api-key"], "clave-de-prueba");
    assert.ok(p1.body.systemInstruction.parts[0].text.includes("<projectGuide>"));
    const decl = p1.body.tools[0].functionDeclarations.find((d) => d.name === "spawn_agent");
    assert.deepEqual(decl.parameters.required, ["agent", "task"]);

    // tercer pedido: user, model(fc-1+SIG_A), user(fr-1), model(fc-2+SIG_B), user(fr-2)
    const c = p3.body.contents;
    assert.deepEqual(c.map((x) => x.role), ["user", "model", "user", "model", "user"]);
    assert.equal(c[1].parts[0].thoughtSignature, "SIG_A");
    assert.equal(c[3].parts[0].thoughtSignature, "SIG_B");
    assert.equal(c[2].parts[0].functionResponse.id, "fc-1");
    assert.equal(c[2].parts[0].functionResponse.name, "read_file");
    assert.ok(c[2].parts[0].functionResponse.response.result.includes("AGENTS.md"));
  } finally { sim.restore(); }
});

test("gemini: llamadas paralelas, firma solo en la primera y respuestas después de todas", async () => {
  const sim = fakeFetch([
    respuesta([
      { functionCall: { id: "p-1", name: "read_file", args: { path: "/AGENTS.md" } }, thoughtSignature: "SIG_P" },
      { functionCall: { id: "p-2", name: "read_file", args: { path: "/package.json" } } },
    ]),
    respuesta([{ text: "leí los dos" }]),
  ]);
  try {
    await turn({ history: [], userText: "lee dos archivos", provider: "gemini" });
    const c = sim.pedidos[1].body.contents;
    assert.deepEqual(c[1].parts.map((p) => [p.functionCall.id, p.thoughtSignature ?? null]), [["p-1", "SIG_P"], ["p-2", null]]);
    assert.deepEqual(c[2].parts.map((p) => p.functionResponse.id), ["p-1", "p-2"]);
  } finally { sim.restore(); }
});

test("gemini: el subagente corre con el modelo rápido del mismo proveedor", async () => {
  const sim = fakeFetch([
    respuesta([{ functionCall: { id: "s-1", name: "spawn_agent", args: { agent: "researcher", task: "lista el repo" } }, thoughtSignature: "SIG_S" }]),
    respuesta([{ text: "informe: hay 21 archivos" }]),
    respuesta([{ text: "El investigador dice que hay 21 archivos." }]),
  ]);
  try {
    const out = await turn({ history: [], userText: "investiga", provider: "gemini" });
    assert.match(sim.pedidos[1].url, /gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(sim.pedidos[1].body.contents.length, 1, "el subagente arranca con un contexto vacío");
    assert.equal(out.trace.events[0].type, "subagent");
  } finally { sim.restore(); }
});

test("anthropic: los campos privados de otros adaptadores no llegan a la API", async () => {
  const sim = fakeFetch([{ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 10 } }]);
  try {
    await anthropic.call({ model: "m", system: "s", messages: [
      { role: "user", content: "hola" },
      { role: "assistant", content: [{ type: "text", text: "x", _gemini: { thoughtSignature: "S" } }] },
      { role: "user", content: "sigue" },
    ] });
    assert.deepEqual(sim.pedidos[0].body.messages[1].content[0], { type: "text", text: "x" });
    assert.equal(sim.pedidos[0].headers["x-api-key"], "clave-de-prueba");
  } finally { sim.restore(); }
});
