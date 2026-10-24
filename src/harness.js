// El loop. Esto es lo que convierte una llamada al modelo en un agente:
//   1. ensamblar contexto  2. llamar  3. si pide herramientas, ejecutarlas y volver a 2
//   + compactar cuando la ventana se acerca al presupuesto (src/window.js)
//   + subagentes: el mismo loop con un contexto vacío y su propio prompt
// El loop no sabe con qué modelo habla: callModel() delega en un proveedor (src/providers/).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { tools, definitions } from "../harness/tools/index.js";
import { loadRouting, assembleSystem, agentsIndex, estimateTokens, historyReport } from "./context.js";
import { budgetFor, planCompaction, compact, maybeOffload } from "./window.js";
import { resolveProvider } from "./providers/index.js";

/** @typedef {import("./types.js").Message} Message */
/** @typedef {import("./types.js").Provider} Provider */
/** @typedef {import("./types.js").Routing} Routing */
/** @typedef {import("./types.js").Trace} Trace */

/**
 * La llamada. Lo único que el modelo "hace". El proveedor traduce ida y vuelta;
 * entra y sale en formato interno: bloques text, tool_use y tool_result.
 * @param {Provider} provider
 * @param {import("./types.js").CallArgs} args
 */
function callModel(provider, args) {
  return provider.call(args);
}

/**
 * El loop. Sirve para el agente principal y para subagentes.
 * @param {{ messages: Message[], agentName?: string | null, routing: Routing, trace: Trace, provider: Provider }} args
 * @returns {Promise<{ text: string, messages: Message[] }>}
 */
export async function runAgent({ messages, agentName = null, routing, trace, provider }) {
  const sys = await assembleSystem({ routing, agentName });
  const toolDefs = await toolDefsFor(routing, agentName);
  const maxLoops = agentName ? routing.agents[agentName]?.maxToolLoops ?? 10 : routing.maxToolLoops;
  const model = modelFor(routing, provider, agentName);
  const budget = budgetFor(routing, provider, model);
  if (!agentName) trace.budget = budget;
  const fixed = estimateTokens(sys.system) + estimateTokens(toolDefs);
  let avisado = false;

  for (let loop = 0; loop < maxLoops; loop++) {
    // ¿la ventana se acerca al presupuesto? decidir antes de llamar.
    const history = historyReport(messages).reduce((a, l) => a + l.tokens, 0);
    const plan = planCompaction({ fixed, history, budget, compactAt: routing.compactAt });
    if (plan === "compact") messages = await compact(messages, { routing, trace, provider });
    if (plan === "full" && !avisado) {
      trace.events.push({ type: "warning", text: `ventana de ${budget} tokens: sistema y herramientas ya ocupan ~${fixed}. Sube ADA_OLLAMA_NUM_CTX.` });
      avisado = true;
    }

    const r = await callModel(provider, { model, system: sys.system, messages, tools: toolDefs });
    trace.calls++;
    trace.lastContext = {
      layers: sys.layers.concat([{ name: "toolDefinitions", tokens: estimateTokens(toolDefs) }], historyReport(messages)),
      usage: r.usage,
    };
    messages.push({ role: "assistant", content: r.content });

    if (r.stop_reason !== "tool_use") {
      const text = r.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
      return { text, messages };
    }

    // El modelo pidió herramientas. El harness las ejecuta y pega los resultados.
    /** @type {import("./types.js").ToolResultBlock[]} */
    const results = [];
    for (const block of r.content) {
      if (block.type !== "tool_use") continue;
      const out = await runTool(block, { routing, trace, provider, budget, agentName });
      trace.tools.push({ name: block.name, input: block.input, tokens: estimateTokens(out), agent: agentName });
      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "(se alcanzó el máximo de iteraciones del loop)", messages };
}

/**
 * Las herramientas que ve cada agente: las de routing.json. Solo el principal puede delegar.
 * @param {Routing} routing
 * @param {string | null} agentName
 */
async function toolDefsFor(routing, agentName) {
  const defs = definitions(agentName ? routing.agents[agentName]?.tools : null);
  if (!agentName) defs.push(spawnDefinition(await agentsIndex(routing)));
  return defs;
}

/**
 * Cuánto pesa cada capa fija del agente principal, sin llamar a ningún modelo (npm run capas).
 * Son las cifras que muestra el inspector en la primera llamada, antes del historial.
 * @param {Routing} routing
 * @returns {Promise<import("./types.js").Layer[]>}
 */
export async function fixedLayers(routing) {
  const { layers } = await assembleSystem({ routing });
  return layers.concat([{ name: "toolDefinitions", tokens: estimateTokens(await toolDefsFor(routing, null)) }]);
}

/**
 * Ejecuta una herramienta pedida por el modelo. Los errores vuelven como texto: el modelo
 * los lee y puede corregir el rumbo, en vez de cortar el turno.
 * @param {import("./types.js").ToolUseBlock} block
 * @param {{ routing: Routing, trace: Trace, provider: Provider, budget: number, agentName: string | null }} ctx
 */
async function runTool(block, { routing, trace, provider, budget, agentName }) {
  try {
    const tool = tools[block.name];
    if (block.name === "spawn_agent" && !agentName) {
      return await maybeOffload(block.name, await spawnAgent(/** @type {{ agent: string, task: string }} */ (block.input), routing, trace, provider), routing, budget);
    }
    if (!tool) return `error: herramienta desconocida ${block.name}`;
    return await maybeOffload(block.name, String(await tool.run(block.input)), routing, budget);
  } catch (e) {
    return `error: ${e.message}`;
  }
}

// --- subagente: contexto nuevo, mismo loop, informe de vuelta. ---
/**
 * La herramienta spawn_agent, armada desde el índice de agentes (decisión 0008): agregar un agente
 * es un archivo en harness/agents/ y una entrada en routing.json, sin tocar este código.
 * @param {{ name: string, description: string }[]} agentes
 * @returns {import("./types.js").ToolDefinition}
 */
export function spawnDefinition(agentes) {
  return {
    name: "spawn_agent",
    description: "Lanza un subagente con un contexto vacío para una tarea acotada. Devuelve solo su informe final. Úsalo para investigar, revisar o implementar sin llenar este contexto. Agentes: "
      + agentes.map((a) => `${a.name} (${a.description})`).join(", ") + ".",
    input_schema: {
      type: "object",
      properties: { agent: { type: "string", enum: agentes.map((a) => a.name) }, task: { type: "string", description: "Instrucción completa. El subagente no ve esta conversación." } },
      required: ["agent", "task"],
    },
  };
}

/**
 * Qué modelo usa cada agente: el principal para el agente principal y para los que routing.json
 * marca con "model": "main"; el rápido para el resto.
 * @param {Routing} routing
 * @param {Provider} provider
 * @param {string | null} agentName
 */
export function modelFor(routing, provider, agentName) {
  if (!agentName) return provider.model();
  return routing.agents[agentName]?.model === "main" ? provider.model() : provider.fastModel();
}

/**
 * @param {{ agent: string, task: string }} input
 * @param {Routing} routing
 * @param {Trace} trace
 * @param {Provider} provider
 */
async function spawnAgent({ agent, task }, routing, trace, provider) {
  if (!routing.agents[agent]) return `error: agente desconocido ${agent}`;
  /** @type {Trace} */
  const child = { calls: 0, tools: [], events: [], lastContext: null };
  const { text } = await runAgent({ messages: [{ role: "user", content: task }], agentName: agent, routing, trace: child, provider });
  trace.events.push({ type: "subagent", agent, calls: child.calls, tools: child.tools.length });
  trace.calls += child.calls;
  return `[informe de ${agent}, ${child.calls} llamadas, ${child.tools.length} herramientas]\n${text}`;
}

/**
 * Un turno completo: lo usan el servidor y la terminal.
 * @param {{ history: Message[], userText: string, provider?: string, model?: string }} args
 * @returns {Promise<{ text: string, history: Message[], trace: Trace }>}
 */
export async function turn({ history, userText, provider: nombre, model }) {
  const routing = await loadRouting();
  const provider = await resolveProvider(nombre, model);
  /** @type {Trace} */
  const trace = { calls: 0, tools: [], events: [], lastContext: null, provider: provider.name, model: provider.model() };
  const messages = history.concat([{ role: "user", content: userText }]);
  const { text, messages: next } = await runAgent({ messages, routing, trace, provider });
  return { text, history: next, trace };
}

// `node src/harness.js "mensaje"` sigue funcionando: delega en src/cli.js.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { main } = await import("./cli.js");
  await main(process.argv.slice(2), { turn, fixedLayers, loadRouting });
}
