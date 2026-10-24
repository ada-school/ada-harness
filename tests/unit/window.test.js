// La ventana de contexto: presupuesto, cuándo compactar y resultados grandes a disco.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { budgetFor, planCompaction, compact, maybeOffload } from "../../src/window.js";
import { loadRouting } from "../../src/context.js";
import { tempWorkspace } from "../helpers/workspace.js";

/** @type {Awaited<ReturnType<typeof tempWorkspace>>} */
let ws;
let routing;
before(async () => { ws = await tempWorkspace(); routing = await loadRouting(); });
after(async () => { await ws.cleanup(); });

/**
 * Proveedor mínimo: devuelve siempre el mismo resumen.
 * @param {Partial<import("../../src/types.js").Provider>} [extra]
 * @returns {import("../../src/types.js").Provider}
 */
const proveedorFalso = (extra = {}) => ({
  name: "falso", label: "Falso", keyEnv: null, configured: () => true,
  model: () => "m", fastModel: () => "rapido",
  call: async () => ({ content: [{ type: "text", text: "RESUMEN" }], stop_reason: "end_turn", usage: {} }),
  ...extra,
});

test("budgetFor: manda routing.json, salvo que el modelo tenga una ventana menor", () => {
  assert.equal(budgetFor(routing, proveedorFalso(), "m"), 120000);
  assert.equal(budgetFor(routing, proveedorFalso({ contextWindow: () => 16384 }), "m"), 16384);
});

test("planCompaction: ok, compactar, o lleno sin remedio", () => {
  const base = { budget: 10000, compactAt: 0.8 };
  assert.equal(planCompaction({ ...base, fixed: 2000, history: 3000 }), "ok");
  assert.equal(planCompaction({ ...base, fixed: 2000, history: 7000 }), "compact");
  assert.equal(planCompaction({ ...base, fixed: 8500, history: 100 }), "full", "resumir el historial no libera nada");
});

test("compact: resume lo viejo y deja un historial que alterna roles", async () => {
  const trace = { calls: 0, tools: [], events: [], lastContext: null };
  const messages = ["u1", "a1", "u2", "a2", "u3", "a3", "u4"].map((t) => ({ role: t[0] === "u" ? "user" : "assistant", content: t }));
  const out = await compact(/** @type {any} */ (messages), { routing, trace, provider: proveedorFalso() });
  assert.deepEqual(out.map((m) => m.role), ["user", "assistant", "user", "assistant", "user"]);
  assert.match(String(out[0].content), /RESUMEN/);
  assert.deepEqual(out.slice(2).map((m) => m.content), ["a2", "u3", "a3", "u4"].slice(1));
  assert.deepEqual(trace.events, [{ type: "compact", droppedMessages: 3, summaryTokens: 2 }]);
});

test("compact: con pocos mensajes no hace nada", async () => {
  const messages = [{ role: "user", content: "hola" }];
  const out = await compact(/** @type {any} */ (messages), { routing, trace: /** @type {any} */ ({ events: [] }), provider: proveedorFalso() });
  assert.equal(out, messages);
});

test("maybeOffload: lo chico pasa, lo grande va a .context del workspace", async () => {
  assert.equal(await maybeOffload("read_file", "corto", routing, 120000), "corto");
  const grande = "x".repeat(30000);                                   // ~7.500 tokens, sobre 6.000
  const ref = await maybeOffload("read_file", grande, routing, 120000);
  const m = ref.match(/read_file\('(\.context\/read_file-\d+\.txt)'\)/);
  assert.ok(m, ref.slice(0, 120));
  assert.equal(await fs.readFile(path.join(ws.dir, m[1]), "utf8"), grande);
});

test("maybeOffload: con ventana chica, el umbral baja a un cuarto del presupuesto", async () => {
  const mediano = "y".repeat(12000);                                   // ~3.000 tokens: bajo 6.000, sobre 8.192/4
  assert.equal(await maybeOffload("read_file", mediano, routing, 120000), mediano);
  assert.match(await maybeOffload("read_file", mediano, routing, 8192), /^\[Resultado largo/);
});
