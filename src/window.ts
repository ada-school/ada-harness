// Edit src/window.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// The context window: how much fits, when to compact, and what to do with large results.
// It is layer 5 of the explainer ("When the window fills up") turned into code.

import { promises as fs } from "node:fs";
import path from "node:path";
import { paths } from "./config.js";
import { estimateTokens } from "./context.js";
import type { Message, Provider, Routing, Trace } from "./types.js";

/**
 * Real budget of a turn: the smaller of routing.json and the model's window
 * (Ollama works with num_ctx; Claude and Gemini declare no limit and routing.json wins).
 * @param {import("./types.js").Routing} routing
 * @param {import("./types.js").Provider} provider
 * @param {string} model
 */
export function budgetFor(routing: Routing, provider: Provider, model: string): number {
  return Math.min(routing.contextBudgetTokens, provider.contextWindow?.(model) ?? Infinity);
}

/**
 * Decides what to do before calling the model. A pure function: tested with no model.
 *   "ok"       it fits
 *   "compact"  the history pushes the window over the threshold: summarizing it frees space
 *   "full"     system + tools alone already pass the threshold: summarizing frees nothing
 * @param {{ fixed: number, history: number, budget: number, compactAt: number }} p
 * @returns {"ok" | "compact" | "full"}
 */
export function planCompaction({ fixed, history, budget, compactAt }: { fixed: number; history: number; budget: number; compactAt: number }): "ok" | "compact" | "full" {
  const umbral = budget * compactAt;
  if (fixed + history <= umbral) return "ok";
  return fixed > umbral ? "full" : "compact";
}

const RESUMEN = "Resume esta conversación entre un usuario y un agente de ingeniería en máximo 400 palabras. Conserva: decisiones tomadas, archivos creados o modificados con su ruta, estado actual de la tarea, y cualquier dato que el usuario dio. Descarta salidas crudas de herramientas.";

/**
 * Compaction: an extra call to the fast model summarizes the old part and replaces it.
 * The history must start with "user" and alternate roles; the summary goes in as a user/assistant
 * pair and the tail is trimmed so it keeps alternating.
 * @param {import("./types.js").Message[]} messages
 * @param {{ routing: import("./types.js").Routing, trace: import("./types.js").Trace, provider: import("./types.js").Provider }} ctx
 * @returns {Promise<import("./types.js").Message[]>}
 */
export async function compact(messages: Message[], { routing, trace, provider }: { routing: Routing; trace: Trace; provider: Provider }): Promise<Message[]> {
  const keep = routing.keepLastMessagesOnCompact;
  if (messages.length <= keep + 1) return messages;
  const old = messages.slice(0, -keep);
  const tail = messages.slice(-keep);
  const dump = old.map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).join("\n").slice(0, 200000);
  const r = await provider.call({
    model: provider.fastModel(),
    system: RESUMEN,
    messages: [{ role: "user", content: dump }],
    maxTokens: 1200,
  });
  const primero = r.content.find((b) => b.type === "text");
  const summary = (primero && primero.type === "text" && primero.text) || "(resumen vacío)";
  trace.events.push({ type: "compact", droppedMessages: old.length, summaryTokens: estimateTokens(summary) });
  const head: Message[] = [
    { role: "user", content: `[Resumen del trabajo anterior, generado por compactación]\n${summary}` },
    { role: "assistant", content: "Entendido. Continúo desde ese estado." },
  ];
  const firstTail = tail[0]?.role === "user" ? tail : tail.slice(1);
  return head.concat(firstTail);
}

/**
 * Large results are stored in workspace/.context and the window keeps a reference.
 * With small windows (local models) the threshold drops to a quarter of the budget.
 * @param {string} name tool that produced the result
 * @param {string} result
 * @param {import("./types.js").Routing} routing
 * @param {number} budget
 */
export async function maybeOffload(name: string, result: string, routing: Routing, budget: number): Promise<string> {
  const limit = Math.min(routing.layers.toolResults.offloadAbove, Math.floor(budget * 0.25));
  if (estimateTokens(result) <= limit) return result;
  const carpeta = routing.layers.toolResults.offloadTo;              // relative to the workspace
  const dir = path.join(paths.workspace, carpeta);
  await fs.mkdir(dir, { recursive: true });
  const file = `${name}-${Date.now()}.txt`;
  await fs.writeFile(path.join(dir, file), result, "utf8");
  const head = result.slice(0, 1500);
  return `[Resultado largo (${estimateTokens(result)} tokens) guardado en workspace/${carpeta}/${file}. Primeras líneas:]\n${head}\n[... usa read_file('${carpeta}/${file}') para ver el resto]`;
}
