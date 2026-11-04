// Edit src/providers/anthropic.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Adapter for the Anthropic Messages API (Claude).
// The harness internal format IS Anthropic's, so there is almost no translation here:
// only the private fields other adapters store on blocks (the ones that start with "_",
// such as _gemini) are removed, because the API rejects fields it does not know.

import type { Block, CallArgs, Message, ModelResponse, Provider } from "../types.js";
import { text } from "../text.js";

const API = "https://api.anthropic.com/v1/messages";

/** @satisfies {import("../types.js").Provider} */
export const anthropic = {
  name: "anthropic",
  label: "Claude",
  keyEnv: "ANTHROPIC_API_KEY",
  model: () => process.env.ADA_ANTHROPIC_MODEL || process.env.ADA_MODEL || "claude-sonnet-5-5",
  fastModel: () => process.env.ADA_ANTHROPIC_FAST_MODEL || process.env.ADA_FAST_MODEL || "claude-haiku-5-5",
  configured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async call({ model, system, messages, tools, maxTokens = 4096 }: CallArgs): Promise<ModelResponse> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error(text("missingKey", { name: "ANTHROPIC_API_KEY" }));
    const res = await fetch(API, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: maxTokens, system,
        messages: messages.map(limpiar),
        ...(tools?.length ? { tools } : {}),
      }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(`Claude: ${data?.error?.message || `HTTP ${res.status}`}`);
    // Already in the internal format: { content: [blocks], stop_reason, usage }
    return { content: data.content, stop_reason: data.stop_reason, usage: data.usage };
  },
} satisfies Provider;

function limpiar(m: Message): Message {
  if (typeof m.content === "string") return m;
  return {
    role: m.role,
    content: m.content.map((b) => Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith("_"))) as Block),
  };
}
