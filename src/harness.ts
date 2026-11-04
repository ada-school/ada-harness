// Edit src/harness.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// The loop. This is what turns a model call into an agent:
//   1. assemble context  2. call  3. if it asks for tools, run them and go back to 2
//   + compact when the window nears the budget (src/window.ts)
//   + subagents: the same loop with an empty context and its own prompt
// The loop does not know which model it talks to: callModel() delegates to a provider (src/providers/).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { tools, definitions } from "../harness/tools/index.js";
import { loadRouting, assembleSystem, agentsIndex, estimateTokens, historyReport } from "./context.js";
import { budgetFor, planCompaction, compact, maybeOffload } from "./window.js";
import { resolveProvider } from "./providers/index.js";
import { validateInput } from "./validation.js";
import { text } from "./text.js";
import type { CallArgs, Layer, Message, ModelResponse, Provider, Routing, ToolDefinition, ToolResultBlock, ToolUseBlock, Trace } from "./types.js";

/** @typedef {import("./types.js").Message} Message */
/** @typedef {import("./types.js").Provider} Provider */
/** @typedef {import("./types.js").Routing} Routing */
/** @typedef {import("./types.js").Trace} Trace */

/**
 * The call. The only thing the model "does". The provider translates both ways;
 * what goes in and out is the internal format: text, tool_use, and tool_result blocks.
 * @param {Provider} provider
 * @param {import("./types.js").CallArgs} args
 */
function callModel(provider: Provider, args: CallArgs): Promise<ModelResponse> {
  return provider.call(args);
}

/**
 * The loop. It serves the main agent and the subagents.
 * @param {{ messages: Message[], agentName?: string | null, routing: Routing, trace: Trace, provider: Provider, onText?: (delta: string) => void }} args
 * @returns {Promise<{ text: string, messages: Message[] }>}
 */
export async function runAgent({ messages, agentName = null, routing, trace, provider, onText }: {
  messages: Message[];
  agentName?: string | null;
  routing: Routing;
  trace: Trace;
  provider: Provider;
  onText?: (delta: string) => void;
}): Promise<{ text: string; messages: Message[] }> {
  const sys = await assembleSystem({ routing, agentName });
  const toolDefs = await toolDefsFor(routing, agentName);
  const maxLoops = agentName ? routing.agents[agentName]?.maxToolLoops ?? 10 : routing.maxToolLoops;
  const model = modelFor(routing, provider, agentName);
  const budget = budgetFor(routing, provider, model);
  if (!agentName) trace.budget = budget;
  const fixed = estimateTokens(sys.system) + estimateTokens(toolDefs);
  let avisado = false;

  for (let loop = 0; loop < maxLoops; loop++) {
    // Is the window nearing the budget? Decide before calling.
    const history = historyReport(messages).reduce((a, l) => a + l.tokens, 0);
    const plan = planCompaction({ fixed, history, budget, compactAt: routing.compactAt });
    if (plan === "compact") messages = await compact(messages, { routing, trace, provider });
    if (plan === "full" && !avisado) {
      trace.events.push({ type: "warning", text: `ventana de ${budget} tokens: sistema y herramientas ya ocupan ~${fixed}. Sube ADA_OLLAMA_NUM_CTX.` });
      avisado = true;
    }

    let streamed = false;
    const r = await callModel(provider, {
      model, system: sys.system, messages, tools: toolDefs,
      ...(onText ? { onText: (delta: string) => { if (!delta) return; streamed = true; onText(delta); } } : {}),
    });
    trace.calls++;
    trace.lastContext = {
      layers: sys.layers.concat([{ name: "toolDefinitions", tokens: estimateTokens(toolDefs) }], historyReport(messages)),
      usage: r.usage,
    };
    messages.push({ role: "assistant", content: r.content });

    if (r.stop_reason !== "tool_use") {
      const text = r.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
      // A provider that does not stream still reaches the terminal and the chat as one piece.
      if (onText && !streamed && text) onText(text);
      return { text, messages };
    }

    // The model asked for tools. The harness runs them and appends the results.
    /** @type {import("./types.js").ToolResultBlock[]} */
    const results: ToolResultBlock[] = [];
    for (const block of r.content) {
      if (block.type !== "tool_use") continue;
      const out = await runTool(block, { routing, trace, provider, budget, agentName });
      trace.tools.push({ name: block.name, input: block.input, tokens: estimateTokens(out), agent: agentName });
      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  const text = "(se alcanzó el máximo de iteraciones del loop)";
  if (onText) onText(text);
  return { text, messages };
}

/**
 * The tools each agent sees: the ones in routing.json. Only the main agent can delegate.
 * @param {Routing} routing
 * @param {string | null} agentName
 */
async function toolDefsFor(routing: Routing, agentName: string | null): Promise<ToolDefinition[]> {
  const defs = definitions(agentName ? routing.agents[agentName]?.tools : null);
  if (!agentName) defs.push(spawnDefinition(await agentsIndex(routing)));
  return defs;
}

/**
 * How much each fixed layer of the main agent weighs, without calling a model (npm run capas).
 * These are the figures the inspector shows on the first call, before the history.
 * @param {Routing} routing
 * @returns {Promise<import("./types.js").Layer[]>}
 */
export async function fixedLayers(routing: Routing): Promise<Layer[]> {
  const { layers } = await assembleSystem({ routing });
  return layers.concat([{ name: "toolDefinitions", tokens: estimateTokens(await toolDefsFor(routing, null)) }]);
}

/**
 * Runs a tool the model asked for. Errors come back as text: the model
 * reads them and can correct course, instead of the turn being cut off.
 * @param {import("./types.js").ToolUseBlock} block
 * @param {{ routing: Routing, trace: Trace, provider: Provider, budget: number, agentName: string | null }} ctx
 */
async function runTool(block: ToolUseBlock, { routing, trace, provider, budget, agentName }: {
  routing: Routing;
  trace: Trace;
  provider: Provider;
  budget: number;
  agentName: string | null;
}): Promise<string> {
  try {
    if (block.name === "spawn_agent") {
      if (agentName) return "error: herramienta desconocida spawn_agent";
      const schema = spawnDefinition(await agentsIndex(routing)).input_schema;
      const errores = validateInput(block.input, schema);
      if (errores.length) return `error: ${text("invalidInput")}\n${errores.join("\n")}`;
      return await maybeOffload(block.name, await spawnAgent(block.input as { agent: string; task: string }, routing, trace, provider), routing, budget);
    }
    const tool = tools[block.name];
    if (!tool) return `error: herramienta desconocida ${block.name}`;
    const errores = validateInput(block.input, tool.definition.input_schema);
    if (errores.length) return `error: ${text("invalidInput")}\n${errores.join("\n")}`;
    return await maybeOffload(block.name, String(await tool.run(block.input)), routing, budget);
  } catch (e) {
    return `error: ${e.message}`;
  }
}

// --- subagent: a fresh context, the same loop, a report back. ---
/**
 * The spawn_agent tool, built from the agent index (decision 0008): adding an agent
 * is a file in harness/agents/ and an entry in routing.json, without touching this code.
 * @param {{ name: string, description: string }[]} agentes
 * @returns {import("./types.js").ToolDefinition}
 */
export function spawnDefinition(agentes: { name: string; description: string }[]): ToolDefinition {
  return {
    name: "spawn_agent",
    description: "Lanza un subagente con un contexto vacío para una tarea acotada. Devuelve solo su informe final. Úsalo para investigar, revisar o implementar sin llenar este contexto. Agentes: "
      + agentes.map((a) => `${a.name} (${a.description})`).join(", ") + ".",
    input_schema: {
      type: "object",
      properties: { agent: { type: "string", enum: agentes.map((a) => a.name) }, task: { type: "string", minLength: 1, maxLength: 20000, description: "Instrucción completa. El subagente no ve esta conversación." } },
      required: ["agent", "task"],
      additionalProperties: false,
    },
  };
}

/**
 * Which model each agent uses: the main one for the main agent and for those routing.json
 * marks with "model": "main"; the fast one for the rest.
 * @param {Routing} routing
 * @param {Provider} provider
 * @param {string | null} agentName
 */
export function modelFor(routing: Routing, provider: Provider, agentName: string | null): string {
  if (!agentName) return provider.model();
  return routing.agents[agentName]?.model === "main" ? provider.model() : provider.fastModel();
}

/**
 * @param {{ agent: string, task: string }} input
 * @param {Routing} routing
 * @param {Trace} trace
 * @param {Provider} provider
 */
async function spawnAgent({ agent, task }: { agent: string; task: string }, routing: Routing, trace: Trace, provider: Provider): Promise<string> {
  if (!routing.agents[agent]) return `error: agente desconocido ${agent}`;
  /** @type {Trace} */
  const child: Trace = { calls: 0, tools: [], events: [], lastContext: null };
  const { text } = await runAgent({ messages: [{ role: "user", content: task }], agentName: agent, routing, trace: child, provider });
  trace.events.push({ type: "subagent", agent, calls: child.calls, tools: child.tools.length });
  trace.calls += child.calls;
  return `[informe de ${agent}, ${child.calls} llamadas, ${child.tools.length} herramientas]\n${text}`;
}

/**
 * A complete turn: the server and the terminal both use it.
 * @param {{ history: Message[], userText: string, provider?: string, model?: string, onText?: (delta: string) => void }} args
 * @returns {Promise<{ text: string, history: Message[], trace: Trace }>}
 */
export async function turn({ history, userText, provider: nombre, model, onText }: {
  history: Message[];
  userText: string;
  provider?: string;
  model?: string;
  onText?: (delta: string) => void;
}): Promise<{ text: string; history: Message[]; trace: Trace }> {
  const routing = await loadRouting();
  const provider = await resolveProvider(nombre, model);
  /** @type {Trace} */
  const trace: Trace = { calls: 0, tools: [], events: [], lastContext: null, provider: provider.name, model: provider.model() };
  const messages = history.concat([{ role: "user", content: userText }]);
  const { text, messages: next } = await runAgent({ messages, routing, trace, provider, onText });
  return { text, history: next, trace };
}

// Running the compiled harness file delegates to src/cli.ts. The documented command is npm run cli.
// Do not import the server here: src/http/api.ts imports this file, and an await of src/server.ts never finishes.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { main } = await import("./cli.js");
  await main(process.argv.slice(2), { turn, fixedLayers, loadRouting, defaultCommand: "run" });
}
