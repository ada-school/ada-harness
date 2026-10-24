// CU-03 Ver qué entró a la ventana de contexto. Lógica pura de app/js/inspector.js.
// El trace tiene la forma real de POST /api/chat.

import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectorView } from "../../../app/js/inspector.js";

const trace = {
  provider: "ollama", model: "qwen3:8b", budget: 16384, calls: 2,
  tools: [{ name: "write_file", input: { path: "a", content: "<img src=x onerror=alert(1)>" }, tokens: 9, agent: null }],
  events: [
    { type: "subagent", agent: "reviewer", calls: 2, tools: 1 },
    { type: "compact", droppedMessages: 3, summaryTokens: 120 },
    { type: "warning", text: "ventana chica" },
  ],
  lastContext: { layers: [{ name: "system", tokens: 1638 }, { name: "toolDefinitions", tokens: 1638 }], usage: { input_tokens: 2100 } },
};

test("CU-03.1 el inspector dice proveedor, modelo y ventana real", () => {
  assert.equal(inspectorView(trace)?.modelo, "proveedor: ollama · qwen3:8b · ventana 16.384");
});

test("CU-03.2 el medidor toma la ventana real como 100% y dice cuánto ocupó la última llamada", () => {
  const v = inspectorView(trace);
  assert.deepEqual(v?.segmentos.map((s) => s.width), ["10.00%", "10.00%"]);
  assert.equal(v?.usado, "~3.276 / 16.384 tokens estimados (20.0%)");
});

test("CU-03.3 sin ventana en el trace, usa la última conocida", () => {
  const v = inspectorView({ ...trace, budget: undefined }, 120000);
  assert.equal(v?.budget, 120000);
  assert.equal(v?.modelo, "proveedor: ollama · qwen3:8b");
});

test("CU-03.5 contadores: llamadas del turno, herramientas y tokens de entrada reales", () => {
  assert.deepEqual(inspectorView(trace)?.contadores, { calls: "2", tools: "1", intok: "2.100" });
});

test("CU-03.6 los eventos son texto plano, también cuando el modelo mete HTML en una herramienta", () => {
  const v = /** @type {NonNullable<ReturnType<typeof inspectorView>>} */ (inspectorView(trace));
  assert.deepEqual(v.eventos.map((e) => e.cls), ["tool", "sub", "cmp", "cmp"]);
  assert.match(v.eventos[0].text, /<img src=x onerror=alert\(1\)>/, "se muestra literal; renderInspector lo pone con textContent");
  assert.equal(v.eventos[1].text, "subagente reviewer: 2 llamadas, 1 herramientas");
  assert.equal(v.eventos[2].text, `compactación: 3 mensajes → resumen de ~120 tok`);
  assert.equal(v.eventos[3].text, "aviso: ventana chica");
});

test("CU-03.7 un turno sin herramientas ni eventos lo dice", () => {
  const v = inspectorView({ ...trace, tools: [], events: [] });
  assert.deepEqual(v?.eventos, [{ cls: "empty", text: "Sin herramientas en este turno." }]);
});

test("CU-03.8 un turno que terminó en error no cambia el inspector", () => {
  assert.equal(inspectorView(undefined), null, "la respuesta con error no trae trace");
});
