// Adaptador para la API de mensajes de Anthropic (Claude).
// El formato interno del harness ES el de Anthropic, así que aquí casi no hay traducción:
// solo se quitan los campos privados que otros adaptadores guardan en los bloques (los que
// empiezan con "_", como _gemini), porque la API rechaza campos que no conoce.

const API = "https://api.anthropic.com/v1/messages";

export const anthropic = {
  name: "anthropic",
  label: "Claude",
  keyEnv: "ANTHROPIC_API_KEY",
  model: () => process.env.ADA_ANTHROPIC_MODEL || process.env.ADA_MODEL || "claude-sonnet-5-5",
  fastModel: () => process.env.ADA_ANTHROPIC_FAST_MODEL || process.env.ADA_FAST_MODEL || "claude-haiku-5-5",
  configured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async call({ model, system, messages, tools, maxTokens = 4096 }) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Falta ANTHROPIC_API_KEY en .env");
    const res = await fetch(API, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: maxTokens, system,
        messages: messages.map(limpiar),
        ...(tools?.length ? { tools } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Claude: ${data?.error?.message || `HTTP ${res.status}`}`);
    // Ya viene en el formato interno: { content: [bloques], stop_reason, usage }
    return { content: data.content, stop_reason: data.stop_reason, usage: data.usage };
  },
};

function limpiar(m) {
  if (typeof m.content === "string") return m;
  return { role: m.role, content: m.content.map((b) => Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith("_")))) };
}
