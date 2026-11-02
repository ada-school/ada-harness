// El loop ejecuta herramientas solo después de validar los argumentos en el servidor.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runAgent } from "../../src/harness.js";
import { loadRouting } from "../../src/context.js";
import { definitions } from "../../harness/tools/index.js";
import { validateInput } from "../../src/validation.js";
import { tempWorkspace } from "../helpers/workspace.js";

/** @type {Awaited<ReturnType<typeof tempWorkspace>>} */
let ws;
/** @type {import("../../src/types.js").Routing} */
let routing;
before(async () => { ws = await tempWorkspace(); routing = await loadRouting(); });
after(async () => { await ws.cleanup(); });

/**
 * @param {import("../../src/types.js").ModelResponse[]} respuestas
 * @returns {import("../../src/types.js").Provider}
 */
const proveedorFalso = (respuestas) => ({
  name: "falso", label: "Falso", keyEnv: null, configured: () => true,
  model: () => "m", fastModel: () => "rapido",
  call: async () => {
    const r = respuestas.shift();
    if (!r) throw new Error("sin respuestas en la simulación");
    return r;
  },
});

test("las definiciones de herramientas son esquemas que el servidor puede validar", () => {
  for (const def of definitions()) {
    assert.doesNotThrow(() => validateInput({}, def.input_schema), def.name);
    assert.equal(def.input_schema.additionalProperties, false, def.name);
  }
});

test("runAgent no ejecuta una herramienta si los argumentos no cumplen el esquema", async () => {
  const destino = path.join(ws.dir, "no-deberia.txt");
  const trace = { calls: 0, tools: [], events: [], lastContext: null };
  const { messages } = await runAgent({
    messages: [{ role: "user", content: "escribe" }],
    routing,
    trace,
    provider: proveedorFalso([
      {
        content: [{ type: "tool_use", id: "1", name: "write_file", input: { path: "no-deberia.txt", extra: true } }],
        stop_reason: "tool_use",
        usage: {},
      },
      { content: [{ type: "text", text: "no pude escribir" }], stop_reason: "end_turn", usage: {} },
    ]),
  });
  const resultados = messages.flatMap((m) => Array.isArray(m.content) ? m.content : []).filter((b) => b.type === "tool_result");
  assert.match(resultados[0].content, /entrada inválida/);
  await assert.rejects(fs.access(destino), { code: "ENOENT" });
});
