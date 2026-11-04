// Edit src/providers/ollama.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Adapter for Ollama: models that run on your machine, with no key and no per-token cost.
//
// Detection: if an Ollama is listening on OLLAMA_HOST (http://localhost:11434 by default),
// the harness finds it on its own, lists the installed models, and enables the ones that
// can use tools (capability "tools"). Ollama cloud models (remote_host) are marked
// separately: they run on Ollama's servers and require an account.
//
// Three things this file watches:
// 1. Context window. With less than 24 GB of VRAM, Ollama uses 4k tokens by default and
//    truncates the start in silence, system prompt included. We set num_ctx (ADA_OLLAMA_NUM_CTX,
//    16384 by default) and the loop compacts against that real window, not against routing.json.
// 2. One model in memory. By default subagents use the same model: loading a second model
//    on a small machine doubles the memory or makes it very slow.
// 3. Format. Calls arrive in message.tool_calls with arguments as an object, sometimes with
//    no id; results come back as role "tool" messages with tool_name (and tool_call_id if there is one).
//
// References: docs/capabilities/tool-calling.mdx, docs/context-length.mdx, and docs/api.md
// in the github.com/ollama/ollama repository.

import type { CallArgs, Message, ModelResponse, Provider, TextBlock, ToolDefinition, ToolUseBlock } from "../types.js";
import { text } from "../text.js";

/**
 * @typedef {{ name: string, tools: boolean, remote: boolean, params: string, context: number | null }} ModeloOllama
 * @typedef {{ disponible: boolean, modelos: ModeloOllama[], error?: string }} EstadoOllama
 */

type ModeloOllama = { name: string; tools: boolean; remote: boolean; params: string; context: number | null };
type EstadoOllama = { disponible: boolean; modelos: ModeloOllama[]; error?: string };

const TTL_MS = 5000;
let cache: { host: string | null; at: number; estado: EstadoOllama | null } = { host: null, at: 0, estado: null };
let secuencia = 0;

/**
 * Where to look for Ollama. OLLAMA_HOST can arrive as "0.0.0.0:11434" (that is the variable
 * its server listens on); it is normalized to a URL with http.
 * @returns {string}
 */
export function host(): string {
  let h = (process.env.OLLAMA_HOST || "http://localhost:11434").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(h)) h = "http://" + h;
  return h.replace("://0.0.0.0", "://127.0.0.1");
}
const numCtx = (): number => Math.max(8192, Number(process.env.ADA_OLLAMA_NUM_CTX) || 16384);

async function pedir(ruta: string, opciones: Record<string, any> = {}, timeoutMs = 1500): Promise<any> {
  const res = await fetch(host() + ruta, { ...opciones, signal: AbortSignal.timeout(timeoutMs) });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Detects Ollama and its models. The result is cached for a few seconds.
 * @param {{ forzar?: boolean }} [opciones]
 * @returns {Promise<EstadoOllama>}
 */
export async function detectar({ forzar = false }: { forzar?: boolean } = {}): Promise<EstadoOllama> {
  const h = host();
  if (!forzar && cache.estado && cache.host === h && Date.now() - cache.at < TTL_MS) return cache.estado;
  let estado: EstadoOllama;
  try {
    const tags = await pedir("/api/tags", {}, 800);
    const modelos: ModeloOllama[] = await Promise.all((tags.models || []).map(async (m: any) => {
      let caps = m.capabilities, contexto: number | null = null;
      if (!caps) {
        // old Ollama versions do not include capabilities in /api/tags
        try {
          const info = await pedir("/api/show", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: m.name }) });
          caps = info.capabilities || [];
          const k = Object.keys(info.model_info || {}).find((x) => x.endsWith(".context_length"));
          if (k) contexto = info.model_info[k];
        } catch { caps = []; }
      }
      return {
        name: m.name,
        tools: caps.includes("tools"),
        remote: Boolean(m.remote_host),
        params: m.details?.parameter_size || "",
        context: contexto,
      };
    }));
    estado = { disponible: true, modelos };
  } catch (e: any) {
    estado = { disponible: false, modelos: [], error: e.name === "TimeoutError" ? text("ollamaTimeout") : text("ollamaNotFound") };
  }
  cache = { host: h, at: Date.now(), estado };
  return estado;
}

const conHerramientas = (): ModeloOllama[] => (cache.estado?.modelos || []).filter((m) => m.tools);
// We prefer a local model; the cloud only if no local model has tools.
const elegido = (): ModeloOllama | undefined => conHerramientas().find((m) => !m.remote) || conHerramientas()[0];

const defaultModel = (): string => process.env.ADA_OLLAMA_MODEL || elegido()?.name || "qwen3:8b";

/** @satisfies {import("../types.js").Provider} */
export const ollama = {
  name: "ollama",
  label: "Ollama",
  keyEnv: null,
  refresh: (opts?: { forzar?: boolean }) => detectar(opts),
  model: () => defaultModel(),
  fastModel: () => process.env.ADA_OLLAMA_FAST_MODEL || defaultModel(),
  configured: () => Boolean(process.env.ADA_OLLAMA_MODEL && cache.estado?.disponible) || Boolean(elegido()),
  contextWindow: (modelo: string) => {
    const m = (cache.estado?.modelos || []).find((x) => x.name === modelo);
    return m?.context ? Math.min(numCtx(), m.context) : numCtx();
  },
  status: () => {
    const e: EstadoOllama = cache.estado || { disponible: false, modelos: [] };
    return {
      host: host(),
      detected: e.disponible,
      reason: !e.disponible ? text("ollamaWhere", { error: e.error || text("ollamaNotFound"), host: host() })
        : !conHerramientas().length ? text("ollamaNoTools") : null,
      models: e.modelos,
    };
  },

  async call({ model, system, messages, tools, maxTokens = 4096, onText }: CallArgs): Promise<ModelResponse> {
    const body = {
      model,
      messages: haciaOllama(system, messages),
      ...(tools?.length ? { tools: tools.map(herramienta) } : {}),
      stream: Boolean(onText),
      options: { num_ctx: ollama.contextWindow(model), num_predict: maxTokens },
    };
    let res: Response;
    try {
      res = await fetch(host() + "/api/chat", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
    } catch {
      throw new Error(text("ollamaDown", { host: host() }));
    }
    if (!res.ok) {
      const data: any = await res.json().catch(() => ({}));
      throw new Error(`Ollama (${model}): ${data.error || `HTTP ${res.status}`}`);
    }
    if (!onText) return desdeOllama(await res.json());
    if (!res.body) throw new Error(text("ollamaDown", { host: host() }));
    let acc: OllamaStream = { content: "", thinking: "", tool_calls: [] };
    const decoder = new TextDecoder();
    let pending = "";
    const take = (line: string) => {
      if (!line.trim()) return;
      const step = reducirLineaOllama(acc, line);
      acc = step.acc;
      if (step.delta) onText(step.delta);
    };
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) take(line);
    }
    pending += decoder.decode();
    if (pending.trim()) take(pending);
    return desdeOllama({
      message: { content: acc.content, thinking: acc.thinking, tool_calls: acc.tool_calls },
      done_reason: acc.done_reason,
      prompt_eval_count: acc.prompt_eval_count,
      eval_count: acc.eval_count,
    });
  },
} satisfies Provider;

/**
 * Internal definition -> Ollama tool format (the same as OpenAI's).
 * @param {import("../types.js").ToolDefinition} t
 */
export function herramienta(t: ToolDefinition): { type: "function"; function: { name: string; description: string; parameters: ToolDefinition["input_schema"] } } {
  return { type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } };
}

/**
 * Internal history -> Ollama messages. The system goes as the first message.
 * @param {string} system
 * @param {import("../types.js").Message[]} messages
 * @returns {any[]}
 */
export function haciaOllama(system: string, messages: Message[]): any[] {
  const nombres = new Map<string, string>();
  for (const m of messages)
    if (m.role === "assistant" && Array.isArray(m.content))
      for (const b of m.content) if (b.type === "tool_use") nombres.set(b.id, b.name);

  const out: any[] = system ? [{ role: "system", content: system }] : [];
  for (const m of messages) {
    if (typeof m.content === "string") { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === "assistant") {
      const texto = m.content.filter((b): b is TextBlock => b.type === "text").map((b) => b.text).join("\n");
      const pensamiento = m.content.map((b) => (b.type === "tool_result" ? undefined : b._ollama?.thinking)).find(Boolean);
      const llamadas = m.content.filter((b): b is ToolUseBlock => b.type === "tool_use").map((b, i) => ({
        ...(b._ollama?.idPropio ? {} : { id: b.id }),
        function: { index: i, name: b.name, arguments: b.input || {} },
      }));
      out.push({ role: "assistant", content: texto, ...(pensamiento ? { thinking: pensamiento } : {}), ...(llamadas.length ? { tool_calls: llamadas } : {}) });
      continue;
    }
    // user turn: each tool_result is a role "tool" message; loose text is a user message
    for (const b of m.content) {
      if (b.type === "tool_result") {
        const contenido = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
        out.push({
          role: "tool",
          tool_name: nombres.get(b.tool_use_id) || "herramienta",
          ...(String(b.tool_use_id).startsWith("ada_") ? {} : { tool_call_id: b.tool_use_id }),
          content: b.is_error ? `error: ${contenido}` : contenido,
        });
      } else if (b.type === "text") {
        out.push({ role: "user", content: b.text });
      }
    }
  }
  return out;
}

type OllamaStream = {
  content: string;
  thinking: string;
  tool_calls: any[];
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

/**
 * One NDJSON line from a streaming `/api/chat`. `message.content` is the new piece, not the whole reply.
 * @param {OllamaStream} acc
 * @param {string} line
 * @returns {{ acc: OllamaStream, delta: string }}
 */
export function reducirLineaOllama(acc: OllamaStream, line: string): { acc: OllamaStream; delta: string } {
  const row = JSON.parse(line);
  const delta = row.message?.content || "";
  const calls = row.message?.tool_calls;
  return {
    delta,
    acc: {
      content: acc.content + delta,
      thinking: acc.thinking + (row.message?.thinking || ""),
      tool_calls: calls?.length ? calls : acc.tool_calls,
      done_reason: row.done_reason || acc.done_reason,
      prompt_eval_count: row.prompt_eval_count ?? acc.prompt_eval_count,
      eval_count: row.eval_count ?? acc.eval_count,
    },
  };
}

/**
 * Ollama response -> internal format.
 * @param {any} data what /api/chat returns
 * @returns {import("../types.js").ModelResponse}
 */
export function desdeOllama(data: any): ModelResponse {
  const msg = data.message || {};
  // some old models mix reasoning into the text; we split it out
  let texto: string = msg.content || "";
  let pensamiento: string = msg.thinking || "";
  texto = texto.replace(/<think>([\s\S]*?)<\/think>/g, (_: string, t: string) => { pensamiento += t; return ""; }).trim();

  const content: (TextBlock | ToolUseBlock)[] = [];
  if (texto) content.push({ type: "text", text: texto });
  for (const tc of msg.tool_calls || []) {
    const f = tc.function || {};
    let args = f.arguments ?? {};
    if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = { raw: args }; } }
    content.push({
      type: "tool_use",
      id: tc.id || `ada_${Date.now().toString(36)}_${secuencia++}`,
      name: f.name,
      input: args,
      ...(tc.id ? {} : { _ollama: { idPropio: true } }),
    });
  }
  if (pensamiento && content.length) {
    const first = content[0];
    if (first.type === "text") first._ollama = { ...first._ollama, thinking: pensamiento };
    else first._ollama = { ...first._ollama, thinking: pensamiento };
  }
  const pidio = content.some((b) => b.type === "tool_use");
  return {
    content,
    stop_reason: pidio ? "tool_use" : data.done_reason === "length" ? "max_tokens" : "end_turn",
    usage: { input_tokens: data.prompt_eval_count ?? 0, output_tokens: data.eval_count ?? 0 },
  };
}
