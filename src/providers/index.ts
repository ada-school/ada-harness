// Edit src/providers/index.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Provider registry. To add one (OpenAI, Mistral…), create a file with the
// same contract as anthropic.ts, gemini.ts, and ollama.ts and register it here:
//
//   { name, label, keyEnv, model(), fastModel(), configured(),
//     call({ model, system, messages, tools, maxTokens }),
//     refresh?(), contextWindow?(model), status?() }
//
// call() receives the history in the internal format and returns { content, stop_reason, usage }
// in the internal format. The loop in src/harness.ts does not know which model it is talking to.

import type { Provider } from "../types.js";
import { text } from "../text.js";
import { anthropic } from "./anthropic.js";
import { gemini } from "./gemini.js";
import { ollama } from "./ollama.js";

/**
 * Order matters: without ADA_PROVIDER, the first one that is ready is used.
 * Ollama is last: if there are no keys but a local Ollama is running, it is used on its own.
 * @type {Record<string, import("../types.js").Provider>}
 */
export const PROVIDERS: Record<string, Provider> = { anthropic, gemini, ollama };

async function refrescar(): Promise<void> {
  await Promise.all(Object.values(PROVIDERS).map((p) => p.refresh?.()));
}

/**
 * Picks the provider: the explicit request, then ADA_PROVIDER, then the first one that is ready.
 * With `model`, returns a copy that uses that model (Ollama can have several installed).
 * @param {string} [nombre]
 * @param {string} [model]
 * @returns {Promise<import("../types.js").Provider>}
 */
export async function resolveProvider(nombre?: string, model?: string): Promise<Provider> {
  await refrescar();
  const pedido = nombre || process.env.ADA_PROVIDER;
  let p: Provider;
  if (pedido) {
    p = PROVIDERS[pedido];
    if (!p) throw new Error(text("unknownProvider", { name: pedido, options: Object.keys(PROVIDERS).join(", ") }));
  } else {
    p = Object.values(PROVIDERS).find((x) => x.configured()) || anthropic;
  }
  if (!model) return p;
  // with a model chosen by hand, subagents use the same one unless a fast model is configured
  const rapidoPropio = p.name === "ollama" ? process.env.ADA_OLLAMA_FAST_MODEL : null;
  return { ...p, model: () => model, fastModel: () => (p.name === "ollama" ? rapidoPropio || model : p.fastModel()) };
}

/**
 * What GET /api/providers shows in the selector: each provider with its status.
 * @returns {Promise<any[]>}
 */
export async function listProviders(): Promise<any[]> {
  await refrescar();
  const activo = (await resolveProvider()).name;
  return Object.values(PROVIDERS).map((p) => ({
    name: p.name, label: p.label, model: p.model(), fastModel: p.fastModel(),
    configured: p.configured(), keyEnv: p.keyEnv, default: p.name === activo,
    ...(p.status ? { status: p.status() } : {}),
  }));
}
