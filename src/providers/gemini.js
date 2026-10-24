// Adaptador para la API de Gemini (generateContent, REST, sin SDK).
//
// El historial interno usa bloques al estilo Anthropic: text, tool_use, tool_result.
// Este archivo traduce en los dos sentidos y respeta tres reglas de Gemini:
//
// 1. Firmas de pensamiento. Gemini 3 y 4 adjuntan una thoughtSignature a ciertas partes
//    (siempre a la primera functionCall de cada paso). Hay que devolverla intacta, en la misma
//    parte, en la siguiente llamada; si falta en el turno actual, la API responde 400.
//    La guardamos en el bloque como _gemini.thoughtSignature y la reponemos al traducir.
// 2. Ids. Cada functionCall trae un id, y la functionResponse debe devolver el mismo id y el
//    mismo name. Si un modelo viejo no manda id, generamos uno interno y no se lo enviamos.
// 3. Fin del turno. Gemini termina con finishReason STOP aunque haya pedido herramientas.
//    La señal real de tool_use es que existan partes functionCall en la respuesta.
//
// Referencias: ai.google.dev/gemini-api/docs/generate-content/function-calling
//              ai.google.dev/gemini-api/docs/generate-content/thought-signatures

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

  async call({ model, system, messages, tools, maxTokens = 4096 }) {
    const key = clave();
    if (!key) throw new Error("Falta GEMINI_API_KEY en .env");
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
    const data = await res.json();
    if (!res.ok) throw new Error(`Gemini: ${data?.error?.message || `HTTP ${res.status}`}`);
    return desdeGemini(data);
  },
};

// Definición de herramienta del harness -> FunctionDeclaration de Gemini.
/**
 * Definición interna -> functionDeclaration de Gemini. Nuestros input_schema usan el subconjunto
 * que Gemini acepta en "parameters": type, properties, required, enum, items, description.
 * @param {import("../types.js").ToolDefinition} t
 */
export function declaracion(t) {
  return { name: t.name, description: t.description, parameters: t.input_schema };
}

/**
 * Historial interno -> contents de Gemini, reponiendo ids y thoughtSignature guardados.
 * @param {import("../types.js").Message[]} messages
 * @returns {any[]}
 */
export function haciaGemini(messages) {
  // la functionResponse necesita el name de la llamada; lo buscamos por id
  const nombres = new Map();
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content))
      for (const b of m.content) if (b.type === "tool_use") nombres.set(b.id, b.name);
  }
  return messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") return { role, parts: [{ text: m.content }] };
    const parts = [];
    for (const b of m.content) {
      const guardada = b.type === "tool_result" ? undefined : b._gemini?.thoughtSignature;
      const firma = guardada ? { thoughtSignature: guardada } : {};
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
 * Respuesta de Gemini -> formato interno.
 * @param {any} data lo que devuelve generateContent
 * @returns {import("../types.js").ModelResponse}
 */
export function desdeGemini(data) {
  const cand = data.candidates?.[0];
  if (!cand) {
    const motivo = data.promptFeedback?.blockReason || "sin candidatos";
    throw new Error(`Gemini no respondió: ${motivo}`);
  }
  /** @type {import("../types.js").Block[]} */
  const content = [];
  for (const p of cand.content?.parts || []) {
    const guardado = p.thoughtSignature ? { _gemini: { thoughtSignature: p.thoughtSignature } } : {};
    if (p.thought) continue;                     // resúmenes de pensamiento: no son respuesta
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
    throw new Error(`Gemini terminó con ${fin}${cand.finishMessage ? `: ${cand.finishMessage}` : ""}`);
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
