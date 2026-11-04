// Edit src/providers/gemini.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Adapter for the Gemini API (generateContent, REST, no SDK).
//
// The internal history uses Anthropic-style blocks: text, tool_use, tool_result.
// This file translates both ways and follows three Gemini rules:
//
// 1. Thought signatures. Gemini 3 and 4 attach a thoughtSignature to certain parts
//    (always to the first functionCall of each step). It must come back intact, on the same
//    part, on the next call; if it is missing in the current turn, the API responds 400.
//    We store it on the block as _gemini.thoughtSignature and put it back when translating.
// 2. Ids. Each functionCall brings an id, and the functionResponse must return the same id and
//    the same name. If an old model sends no id, we generate an internal one and do not send it.
// 3. End of the turn. Gemini finishes with finishReason STOP even when it asked for tools.
//    The real signal of tool_use is that the response contains functionCall parts.
//
// References: ai.google.dev/gemini-api/docs/generate-content/function-calling
//             ai.google.dev/gemini-api/docs/generate-content/thought-signatures

import type { Block, CallArgs, Message, ModelResponse, Provider, ToolDefinition } from "../types.js";
import { text } from "../text.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const clave = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let secuencia = 0;

/** @satisfies {import("../types.js").Provider} */
export const gemini = {
  name: "gemini",
  label: "Gemini",
  keyEnv: "GEMINI_API_KEY",
  model: () => process.env.ADA_GEMINI_MODEL || "gemini-3.8-flash",
  fastModel: () => process.env.ADA_GEMINI_FAST_MODEL || "gemini-3.5-flash-lite",
  configured: () => Boolean(clave()),

  async call({ model, system, messages, tools, maxTokens = 4096 }: CallArgs): Promise<ModelResponse> {
    // ponytail: Gemini 2.5 and newer cache this prefix on their own. Explicit cachedContents is a second resource, and Gemini 4 dropped it.
    const key = clave();
    if (!key) throw new Error(text("missingKey", { name: "GEMINI_API_KEY" }));
    const body = {
      contents: haciaGemini(messages),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      ...(tools?.length ? { tools: [{ functionDeclarations: tools.map(declaracion) }] } : {}),
      generationConfig: { maxOutputTokens: maxTokens },
    };
    const res = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(`Gemini: ${data?.error?.message || `HTTP ${res.status}`}`);
    return desdeGemini(data);
  },
} satisfies Provider;

// Harness tool definition -> Gemini FunctionDeclaration.
/**
 * Internal definition -> Gemini functionDeclaration. Our input_schema values use the subset
 * Gemini accepts in "parameters": type, properties, required, enum, items, description.
 * @param {import("../types.js").ToolDefinition} t
 */
export function declaracion(t: ToolDefinition): { name: string; description: string; parameters: ToolDefinition["input_schema"] } {
  return { name: t.name, description: t.description, parameters: t.input_schema };
}

/**
 * Internal history -> Gemini contents, putting back the stored ids and thoughtSignature.
 * @param {import("../types.js").Message[]} messages
 * @returns {any[]}
 */
export function haciaGemini(messages: Message[]): any[] {
  // functionResponse needs the call's name; we look it up by id
  const nombres = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content))
      for (const b of m.content) if (b.type === "tool_use") nombres.set(b.id, b.name);
  }
  return messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") return { role, parts: [{ text: m.content }] };
    const parts: any[] = [];
    for (const b of m.content) {
      const guardada = b.type === "tool_result" ? undefined : b._gemini?.thoughtSignature;
      const firma: { thoughtSignature?: string } = guardada ? { thoughtSignature: guardada } : {};
      if (b.type === "text") {
        if (b.text || firma.thoughtSignature) parts.push({ text: b.text || "", ...firma });
      } else if (b.type === "tool_use") {
        const id = b._gemini?.idPropio ? {} : { id: b.id };
        parts.push({ functionCall: { ...id, name: b.name, args: b.input || {} }, ...firma });
      } else if (b.type === "tool_result") {
        const idPropio = String(b.tool_use_id).startsWith("ada_");
        const contenido = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
        parts.push({ functionResponse: {
          ...(idPropio ? {} : { id: b.tool_use_id }),
          name: nombres.get(b.tool_use_id) || "herramienta",
          response: b.is_error ? { error: contenido } : { result: contenido },
        } });
      }
    }
    return { role, parts };
  });
}

/**
 * Gemini response -> internal format.
 * @param {any} data what generateContent returns
 * @returns {import("../types.js").ModelResponse}
 */
export function desdeGemini(data: any): ModelResponse {
  const cand = data.candidates?.[0];
  if (!cand) {
    const motivo = data.promptFeedback?.blockReason || text("noCandidates");
    throw new Error(text("geminiNoReply", { reason: motivo }));
  }
  const content: Block[] = [];
  for (const p of cand.content?.parts || []) {
    const guardado = p.thoughtSignature ? { _gemini: { thoughtSignature: p.thoughtSignature } } : {};
    if (p.thought) continue;                     // thought summaries: not the reply
    if (p.functionCall) {
      const fc = p.functionCall;
      const idPropio = !fc.id;
      content.push({
        type: "tool_use",
        id: fc.id || `ada_${Date.now().toString(36)}_${secuencia++}`,
        name: fc.name,
        input: fc.args || {},
        ...(idPropio || p.thoughtSignature
          ? { _gemini: { ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}), ...(idPropio ? { idPropio: true } : {}) } }
          : {}),
      });
    } else if (typeof p.text === "string") {
      content.push({ type: "text", text: p.text, ...guardado });
    }
  }
  const pidioHerramienta = content.some((b) => b.type === "tool_use");
  const fin = cand.finishReason;
  if (!pidioHerramienta && !content.some((b) => b.type === "text" && b.text) && fin && fin !== "STOP" && fin !== "MAX_TOKENS") {
    throw new Error(text("geminiFinished", { reason: fin }) + (cand.finishMessage ? `: ${cand.finishMessage}` : ""));
  }
  const u = data.usageMetadata || {};
  return {
    content,
    stop_reason: pidioHerramienta ? "tool_use" : fin === "MAX_TOKENS" ? "max_tokens" : "end_turn",
    usage: {
      input_tokens: u.promptTokenCount ?? 0,
      output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    },
  };
}
