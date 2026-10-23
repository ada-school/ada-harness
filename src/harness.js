// El loop. Esto es lo que convierte una llamada al modelo en un agente:
//   1. ensamblar contexto  2. llamar  3. si pide herramientas, ejecutarlas y volver a 2
//   + compactar cuando la ventana se acerca al presupuesto
//   + subagentes: el mismo loop con un contexto vacío y su propio prompt

import { promises as fs } from "node:fs";
import path from "node:path";
import { tools, definitions } from "../harness/tools/index.js";
import { ROOT, loadRouting, assembleSystem, estimateTokens, historyReport } from "./context.js";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ADA_MODEL || "claude-sonnet-5-5";
const FAST = process.env.ADA_FAST_MODEL || "claude-haiku-5-5";

// --- la llamada. Lo único que el modelo "hace". ---
async function callModel({ model, system, messages, tools: toolDefs, maxTokens = 4096 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY (copia .env.example a .env)");
  const res = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, ...(toolDefs?.length ? { tools: toolDefs } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `API ${res.status}`);
  return data;
}

// --- compactación: una llamada extra resume lo viejo y lo reemplaza. ---
async function compact(messages, routing, trace) {
  const keep = routing.keepLastMessagesOnCompact;
  if (messages.length <= keep + 1) return messages;
  const old = messages.slice(0, -keep);
  const tail = messages.slice(-keep);
  const dump = old.map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).join("\n").slice(0, 200000);
  const r = await callModel({
    model: FAST,
    system: "Resume esta conversación entre un usuario y un agente de ingeniería en máximo 400 palabras. Conserva: decisiones tomadas, archivos creados o modificados con su ruta, estado actual de la tarea, y cualquier dato que el usuario dio. Descarta salidas crudas de herramientas.",
    messages: [{ role: "user", content: dump }],
    maxTokens: 1200,
  });
  const summary = r.content.find((b) => b.type === "text")?.text || "(resumen vacío)";
  trace.events.push({ type: "compact", droppedMessages: old.length, summaryTokens: estimateTokens(summary) });
  // El historial debe empezar con un turno de usuario y alternar. El resumen va como user,
  // seguido de un assistant corto, y luego la cola intacta (que empieza en user si keep es par).
  const head = [
    { role: "user", content: `[Resumen del trabajo anterior, generado por compactación]\n${summary}` },
    { role: "assistant", content: "Entendido. Continúo desde ese estado." },
  ];
  const firstTail = tail[0]?.role === "user" ? tail : tail.slice(1);
  return head.concat(firstTail);
}

// --- resultados grandes se van a disco y dejan una referencia. ---
async function maybeOffload(name, result, routing) {
  const limit = routing.layers.toolResults.offloadAbove;
  if (estimateTokens(result) <= limit) return result;
  const dir = path.join(ROOT, routing.layers.toolResults.offloadTo);
  await fs.mkdir(dir, { recursive: true });
  const file = `${name}-${Date.now()}.txt`;
  await fs.writeFile(path.join(dir, file), result, "utf8");
  const head = result.slice(0, 1500);
  return `[Resultado largo (${estimateTokens(result)} tokens) guardado en ${routing.layers.toolResults.offloadTo}/${file}. Primeras líneas:]\n${head}\n[... usa read_file('/${routing.layers.toolResults.offloadTo}/${file}') para ver el resto]`;
}

// --- el loop. Sirve para el agente principal y para subagentes. ---
export async function runAgent({ messages, agentName = null, routing, trace }) {
  const sys = await assembleSystem({ routing, agentName });
  const allowed = agentName ? routing.agents[agentName]?.tools : null;
  const toolDefs = definitions(allowed);
  if (!agentName) toolDefs.push(SPAWN_DEF);
  const maxLoops = agentName ? routing.agents[agentName]?.maxToolLoops ?? 10 : routing.maxToolLoops;
  const budget = routing.contextBudgetTokens;

  for (let loop = 0; loop < maxLoops; loop++) {
    // ¿la ventana se acerca al presupuesto? compactar antes de llamar.
    const used = estimateTokens(sys.system) + estimateTokens(toolDefs) + historyReport(messages).reduce((a, l) => a + l.tokens, 0);
    if (used > budget * routing.compactAt) messages = await compact(messages, routing, trace);

    const r = await callModel({ model: agentName ? FAST : MODEL, system: sys.system, messages, tools: toolDefs });
    trace.calls++;
    trace.lastContext = { layers: sys.layers.concat([{ name: "toolDefinitions", tokens: estimateTokens(toolDefs) }], historyReport(messages)), usage: r.usage };
    messages.push({ role: "assistant", content: r.content });

    if (r.stop_reason !== "tool_use") {
      return { text: r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"), messages };
    }

    // El modelo pidió herramientas. El harness las ejecuta y pega los resultados.
    const results = [];
    for (const block of r.content.filter((b) => b.type === "tool_use")) {
      let out;
      try {
        out = block.name === "spawn_agent"
          ? await spawnAgent(block.input, routing, trace)
          : await tools[block.name].run(block.input);
        out = await maybeOffload(block.name, String(out), routing);
      } catch (e) {
        out = `error: ${e.message}`;
      }
      trace.tools.push({ name: block.name, input: block.input, tokens: estimateTokens(out), agent: agentName });
      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "(se alcanzó el máximo de iteraciones del loop)", messages };
}

// --- subagente: contexto nuevo, mismo loop, informe de vuelta. ---
const SPAWN_DEF = {
  name: "spawn_agent",
  description: "Lanza un subagente con un contexto vacío para una tarea acotada. Devuelve solo su informe final. Úsalo para investigar o revisar sin llenar este contexto. Agentes: researcher (explorar y resumir), reviewer (revisar código y correr pruebas).",
  input_schema: {
    type: "object",
    properties: { agent: { type: "string", enum: ["researcher", "reviewer"] }, task: { type: "string", description: "Instrucción completa. El subagente no ve esta conversación." } },
    required: ["agent", "task"],
  },
};
async function spawnAgent({ agent, task }, routing, trace) {
  if (!routing.agents[agent]) return `error: agente desconocido ${agent}`;
  const child = { calls: 0, tools: [], events: [] };
  const { text } = await runAgent({ messages: [{ role: "user", content: task }], agentName: agent, routing, trace: child });
  trace.events.push({ type: "subagent", agent, calls: child.calls, tools: child.tools.length });
  trace.calls += child.calls;
  return `[informe de ${agent}, ${child.calls} llamadas, ${child.tools.length} herramientas]\n${text}`;
}

// --- un turno completo, usado por el servidor. ---
export async function turn({ history, userText }) {
  const routing = await loadRouting();
  const trace = { calls: 0, tools: [], events: [], lastContext: null };
  const messages = history.concat([{ role: "user", content: userText }]);
  const { text, messages: next } = await runAgent({ messages, routing, trace });
  return { text, history: next, trace };
}

// --- uso desde la terminal: node src/harness.js "mensaje" ---
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const msg = process.argv.slice(2).join(" ") || "Lista los archivos del workspace y dime qué hay.";
  turn({ history: [], userText: msg }).then(({ text, trace }) => {
    console.log(text);
    console.error(`\n[${trace.calls} llamadas, ${trace.tools.length} herramientas]`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
