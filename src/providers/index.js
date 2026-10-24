// Registro de proveedores. Para agregar uno nuevo (OpenAI, Mistral…), crea un archivo con el
// mismo contrato que anthropic.js, gemini.js y ollama.js y regístralo aquí:
//
//   { name, label, keyEnv, model(), fastModel(), configured(),
//     call({ model, system, messages, tools, maxTokens }),
//     refresh?(), contextWindow?(model), status?() }
//
// call() recibe el historial en formato interno y devuelve { content, stop_reason, usage } en
// formato interno. El loop de src/harness.js no sabe con qué modelo habla.

import { anthropic } from "./anthropic.js";
import { gemini } from "./gemini.js";
import { ollama } from "./ollama.js";

/**
 * El orden importa: sin ADA_PROVIDER, se usa el primero que esté listo.
 * Ollama va último: si no hay claves pero hay un Ollama local, se usa solo.
 * @type {Record<string, import("../types.js").Provider>}
 */
export const PROVIDERS = { anthropic, gemini, ollama };

async function refrescar() {
  await Promise.all(Object.values(PROVIDERS).map((p) => p.refresh?.()));
}

/**
 * Elige el proveedor: el pedido explícito, después ADA_PROVIDER, después el primero listo.
 * Con `model`, devuelve una copia que usa ese modelo (Ollama puede tener varios instalados).
 * @param {string} [nombre]
 * @param {string} [model]
 * @returns {Promise<import("../types.js").Provider>}
 */
export async function resolveProvider(nombre, model) {
  await refrescar();
  const pedido = nombre || process.env.ADA_PROVIDER;
  let p;
  if (pedido) {
    p = PROVIDERS[pedido];
    if (!p) throw new Error(`Proveedor desconocido: ${pedido}. Opciones: ${Object.keys(PROVIDERS).join(", ")}`);
  } else {
    p = Object.values(PROVIDERS).find((x) => x.configured()) || anthropic;
  }
  if (!model) return p;
  // con un modelo elegido a mano, los subagentes usan el mismo salvo que haya uno rápido configurado
  const rapidoPropio = p.name === "ollama" ? process.env.ADA_OLLAMA_FAST_MODEL : null;
  return { ...p, model: () => model, fastModel: () => (p.name === "ollama" ? rapidoPropio || model : p.fastModel()) };
}

/**
 * Lo que GET /api/providers muestra en el selector: cada proveedor con su estado.
 * @returns {Promise<any[]>}
 */
export async function listProviders() {
  await refrescar();
  const activo = (await resolveProvider()).name;
  return Object.values(PROVIDERS).map((p) => ({
    name: p.name, label: p.label, model: p.model(), fastModel: p.fastModel(),
    configured: p.configured(), keyEnv: p.keyEnv, default: p.name === activo,
    ...(p.status ? { status: p.status() } : {}),
  }));
}
