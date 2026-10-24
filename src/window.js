// La ventana de contexto: cuánto cabe, cuándo compactar y qué hacer con resultados grandes.
// Es la capa 5 del explicador ("Cuando la ventana se llena") convertida en código.

import { promises as fs } from "node:fs";
import path from "node:path";
import { paths } from "./config.js";
import { estimateTokens } from "./context.js";

/**
 * Presupuesto real de un turno: el menor entre routing.json y la ventana del modelo
 * (Ollama trabaja con num_ctx; Claude y Gemini no declaran límite y manda routing.json).
 * @param {import("./types.js").Routing} routing
 * @param {import("./types.js").Provider} provider
 * @param {string} model
 */
export function budgetFor(routing, provider, model) {
  return Math.min(routing.contextBudgetTokens, provider.contextWindow?.(model) ?? Infinity);
}

/**
 * Decide qué hacer antes de llamar al modelo. Función pura: se prueba sin modelo.
 *   "ok"       cabe sin problema
 *   "compact"  el historial empuja la ventana sobre el umbral: resumirlo libera espacio
 *   "full"     sistema + herramientas solos ya pasan el umbral: resumir no libera nada
 * @param {{ fixed: number, history: number, budget: number, compactAt: number }} p
 * @returns {"ok" | "compact" | "full"}
 */
export function planCompaction({ fixed, history, budget, compactAt }) {
  const umbral = budget * compactAt;
  if (fixed + history <= umbral) return "ok";
  return fixed > umbral ? "full" : "compact";
}

const RESUMEN = "Resume esta conversación entre un usuario y un agente de ingeniería en máximo 400 palabras. Conserva: decisiones tomadas, archivos creados o modificados con su ruta, estado actual de la tarea, y cualquier dato que el usuario dio. Descarta salidas crudas de herramientas.";

/**
 * Compactación: una llamada extra al modelo rápido resume lo viejo y lo reemplaza.
 * El historial debe empezar en "user" y alternar roles; el resumen va como un par user/assistant
 * y la cola se recorta para que siga alternando.
 * @param {import("./types.js").Message[]} messages
 * @param {{ routing: import("./types.js").Routing, trace: import("./types.js").Trace, provider: import("./types.js").Provider }} ctx
 * @returns {Promise<import("./types.js").Message[]>}
 */
export async function compact(messages, { routing, trace, provider }) {
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
  /** @type {import("./types.js").Message[]} */
  const head = [
    { role: "user", content: `[Resumen del trabajo anterior, generado por compactación]\n${summary}` },
    { role: "assistant", content: "Entendido. Continúo desde ese estado." },
  ];
  const firstTail = tail[0]?.role === "user" ? tail : tail.slice(1);
  return head.concat(firstTail);
}

/**
 * Resultados grandes se guardan en workspace/.context y en la ventana queda una referencia.
 * Con ventanas chicas (modelos locales) el umbral baja a un cuarto del presupuesto.
 * @param {string} name herramienta que produjo el resultado
 * @param {string} result
 * @param {import("./types.js").Routing} routing
 * @param {number} budget
 */
export async function maybeOffload(name, result, routing, budget) {
  const limit = Math.min(routing.layers.toolResults.offloadAbove, Math.floor(budget * 0.25));
  if (estimateTokens(result) <= limit) return result;
  const carpeta = routing.layers.toolResults.offloadTo;              // relativa al workspace
  const dir = path.join(paths.workspace, carpeta);
  await fs.mkdir(dir, { recursive: true });
  const file = `${name}-${Date.now()}.txt`;
  await fs.writeFile(path.join(dir, file), result, "utf8");
  const head = result.slice(0, 1500);
  return `[Resultado largo (${estimateTokens(result)} tokens) guardado en workspace/${carpeta}/${file}. Primeras líneas:]\n${head}\n[... usa read_file('${carpeta}/${file}') para ver el resto]`;
}
