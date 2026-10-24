// Agentes (decisión 0008): un agente es un archivo en harness/agents/ y una entrada en routing.json.
// spawn_agent se arma desde ese índice, sin listas escritas a mano en el código.

import { test } from "node:test";
import assert from "node:assert/strict";
import { agentsIndex, assembleSystem, loadRouting, estimateTokens } from "../../src/context.js";
import { spawnDefinition, modelFor, fixedLayers } from "../../src/harness.js";
import { tools, definitions } from "../../harness/tools/index.js";

const routing = await loadRouting();
const indice = await agentsIndex(routing);

test("cada agente de routing.json tiene su archivo con name y una description de una línea", () => {
  assert.deepEqual(indice.map((a) => a.name), Object.keys(routing.agents));
  for (const a of indice) {
    assert.ok(a.description.length >= 15 && a.description.length <= 90, `${a.name}: "${a.description}"`);
  }
});

test("los agentes usan solo herramientas que existen, y ninguno lanza otro agente", () => {
  for (const [nombre, a] of Object.entries(routing.agents)) {
    for (const h of a.tools) assert.ok(h in tools, `${nombre} pide la herramienta ${h}, que no existe`);
    assert.ok(!a.tools.includes("spawn_agent"), nombre);
    assert.ok(a.model === undefined || a.model === "main" || a.model === "fast", `${nombre}: model "${a.model}"`);
  }
});

test("los roles: researcher y reviewer no escriben; frontend sí; qa revisa sin escribir", () => {
  const escribe = (/** @type {string} */ n) => routing.agents[n].tools.includes("write_file");
  assert.deepEqual(["researcher", "reviewer", "frontend", "qa"].map(escribe), [false, false, true, false]);
  assert.ok(routing.agents.qa.tools.includes("run_command"), "qa corre el check del proyecto");
  assert.ok(routing.agents.frontend.tools.includes("load_skill"), "frontend carga su proceso");
});

test("spawn_agent se arma desde el índice: cada agente con su descripción", () => {
  const def = spawnDefinition(indice);
  assert.equal(def.name, "spawn_agent");
  assert.deepEqual(def.input_schema.properties.agent.enum, ["researcher", "reviewer", "frontend", "qa"]);
  for (const a of indice) assert.ok(def.description.includes(`${a.name} (${a.description})`), a.name);
  assert.deepEqual(def.input_schema.required, ["agent", "task"]);
});

test("un subagente recibe el cuerpo de su archivo, sin el frontmatter", async () => {
  const { system, layers } = await assembleSystem({ routing, agentName: "frontend" });
  assert.deepEqual(layers.map((l) => l.name), ["system (agente: frontend)", "projectGuide"]);
  assert.match(system, /subagente de front end/);
  assert.doesNotMatch(system, /^name: frontend$/m);
});

test("modelo por agente: el principal para quien lo pide en routing.json, el rápido para el resto", () => {
  const proveedor = /** @type {any} */ ({ model: () => "grande", fastModel: () => "chico" });
  assert.equal(modelFor(routing, proveedor, null), "grande", "agente principal");
  assert.equal(modelFor(routing, proveedor, "frontend"), "grande");
  assert.equal(modelFor(routing, proveedor, "qa"), "grande");
  assert.equal(modelFor(routing, proveedor, "researcher"), "chico");
  assert.equal(modelFor(routing, proveedor, "no-existe"), "chico");
});

test("npm run capas: las capas fijas del agente principal, con spawn_agent dentro de las herramientas", async () => {
  const capas = await fixedLayers(routing);
  assert.deepEqual(capas.map((c) => c.name), ["system", "projectGuide", "skillsIndex", "memoryCore", "memoryIndex", "toolDefinitions"]);
  const herramientas = definitions(null).concat(spawnDefinition(indice));
  assert.equal(capas.at(-1)?.tokens, estimateTokens(herramientas), "lo mismo que el modelo recibe en cada llamada");
});
