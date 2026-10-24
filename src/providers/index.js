// Registro de proveedores. Para agregar uno nuevo (OpenAI, Ollama, Mistral…), crea un archivo
// con el mismo contrato que anthropic.js y gemini.js y regístralo aquí:
//
//   { name, label, keyEnv, model(), fastModel(), configured(), call({ model, system, messages, tools, maxTokens }) }
//
// call() recibe el historial en formato interno y devuelve { content, stop_reason, usage } en
// formato interno. El loop de src/harness.js no sabe con qué modelo habla.

import { anthropic } from "./anthropic.js";
import { gemini } from "./gemini.js";

export const PROVIDERS = { anthropic, gemini };

// Elige el proveedor: el pedido explícito, después ADA_PROVIDER, después el primero con clave.
export function getProvider(nombre) {
  const pedido = nombre || process.env.ADA_PROVIDER;
  if (pedido) {
    const p = PROVIDERS[pedido];
    if (!p) throw new Error(`Proveedor desconocido: ${pedido}. Opciones: ${Object.keys(PROVIDERS).join(", ")}`);
    return p;
  }
  return Object.values(PROVIDERS).find((p) => p.configured()) || anthropic;
}

export function listProviders() {
  const activo = getProvider().name;
  return Object.values(PROVIDERS).map((p) => ({
    name: p.name, label: p.label, model: p.model(), fastModel: p.fastModel(),
    configured: p.configured(), keyEnv: p.keyEnv, default: p.name === activo,
  }));
}
