// Adaptador para Ollama: modelos que corren en tu máquina, sin clave y sin costo por token.
//
// Detección: si hay un Ollama escuchando en OLLAMA_HOST (por defecto http://localhost:11434),
// el harness lo encuentra solo, lista los modelos instalados y habilita los que saben usar
// herramientas (capability "tools"). Los modelos de la nube de Ollama (remote_host) se marcan
// aparte: corren en servidores de Ollama y requieren cuenta.
//
// Tres cosas que este archivo cuida:
// 1. Ventana de contexto. Con menos de 24 GB de VRAM, Ollama usa 4k tokens por defecto y
//    trunca el inicio en silencio, system prompt incluido. Fijamos num_ctx (ADA_OLLAMA_NUM_CTX,
//    16384 por defecto) y el loop compacta contra esa ventana real, no contra routing.json.
// 2. Un solo modelo en memoria. Por defecto los subagentes usan el mismo modelo: cargar un
//    segundo modelo en una máquina chica duplica la memoria o lo vuelve muy lento.
// 3. Formato. Las llamadas llegan en message.tool_calls con arguments como objeto, a veces sin
//    id; los resultados vuelven como mensajes role "tool" con tool_name (y tool_call_id si hay).
//
// Referencias: docs/capabilities/tool-calling.mdx, docs/context-length.mdx y docs/api.md
// del repositorio github.com/ollama/ollama.

/**
 * @typedef {{ name: string, tools: boolean, remote: boolean, params: string, context: number | null }} ModeloOllama
 * @typedef {{ disponible: boolean, modelos: ModeloOllama[], error?: string }} EstadoOllama
 */

const TTL_MS = 5000;
/** @type {{ host: string | null, at: number, estado: EstadoOllama | null }} */
let cache = { host: null, at: 0, estado: null };
let secuencia = 0;

// OLLAMA_HOST puede venir como "0.0.0.0:11434" (es la variable con la que el servidor escucha).
export function host() {
  let h = (process.env.OLLAMA_HOST || "http://localhost:11434").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(h)) h = "http://" + h;
  return h.replace("://0.0.0.0", "://127.0.0.1");
}
const numCtx = () => Math.max(8192, Number(process.env.ADA_OLLAMA_NUM_CTX) || 16384);

async function pedir(ruta, opciones = {}, timeoutMs = 1500) {
  const res = await fetch(host() + ruta, { ...opciones, signal: AbortSignal.timeout(timeoutMs) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Detecta Ollama y sus modelos. Resultado cacheado unos segundos.
 * @param {{ forzar?: boolean }} [opciones]
 * @returns {Promise<EstadoOllama>}
 */
export async function detectar({ forzar = false } = {}) {
  const h = host();
  if (!forzar && cache.estado && cache.host === h && Date.now() - cache.at < TTL_MS) return cache.estado;
  /** @type {EstadoOllama} */
  let estado;
  try {
    const tags = await pedir("/api/tags", {}, 800);
    const modelos = await Promise.all((tags.models || []).map(async (m) => {
      let caps = m.capabilities, contexto = null;
      if (!caps) {
        // versiones viejas de Ollama no traen capabilities en /api/tags
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
  } catch (e) {
    estado = { disponible: false, modelos: [], error: e.name === "TimeoutError" ? "no responde" : "no detectado" };
  }
  cache = { host: h, at: Date.now(), estado };
  return estado;
}

const conHerramientas = () => (cache.estado?.modelos || []).filter((m) => m.tools);
// Preferimos un modelo local; la nube solo si no hay ninguno local con herramientas.
const elegido = () => conHerramientas().find((m) => !m.remote) || conHerramientas()[0];

/** @satisfies {import("../types.js").Provider} */
export const ollama = {
  name: "ollama",
  label: "Ollama",
  keyEnv: null,
  refresh: (opts) => detectar(opts),
  model: () => process.env.ADA_OLLAMA_MODEL || elegido()?.name || "qwen3:8b",
  fastModel: () => process.env.ADA_OLLAMA_FAST_MODEL || ollama.model(),
  configured: () => Boolean(process.env.ADA_OLLAMA_MODEL && cache.estado?.disponible) || Boolean(elegido()),
  contextWindow: (modelo) => {
    const m = (cache.estado?.modelos || []).find((x) => x.name === modelo);
    return m?.context ? Math.min(numCtx(), m.context) : numCtx();
  },
  status: () => {
    /** @type {EstadoOllama} */
    const e = cache.estado || { disponible: false, modelos: [] };
    return {
      host: host(),
      detected: e.disponible,
      reason: !e.disponible ? `${e.error || "no detectado"} en ${host()}`
        : !conHerramientas().length ? "ningún modelo instalado usa herramientas" : null,
      models: e.modelos,
    };
  },

  async call({ model, system, messages, tools, maxTokens = 4096 }) {
    const body = {
      model,
      messages: haciaOllama(system, messages),
      ...(tools?.length ? { tools: tools.map(herramienta) } : {}),
      stream: false,
      options: { num_ctx: ollama.contextWindow(model), num_predict: maxTokens },
    };
    let res;
    try {
      res = await fetch(host() + "/api/chat", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
    } catch {
      throw new Error(`Ollama no responde en ${host()}. ¿Está corriendo? Prueba: ollama serve`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Ollama (${model}): ${data.error || `HTTP ${res.status}`}`);
    return desdeOllama(data);
  },
};

export function herramienta(t) {
  return { type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } };
}

// Historial interno -> messages de Ollama.
export function haciaOllama(system, messages) {
  const nombres = new Map();
  for (const m of messages)
    if (m.role === "assistant" && Array.isArray(m.content))
      for (const b of m.content) if (b.type === "tool_use") nombres.set(b.id, b.name);

  const out = system ? [{ role: "system", content: system }] : [];
  for (const m of messages) {
    if (typeof m.content === "string") { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === "assistant") {
      const texto = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const pensamiento = m.content.map((b) => b._ollama?.thinking).find(Boolean);
      const llamadas = m.content.filter((b) => b.type === "tool_use").map((b, i) => ({
        ...(b._ollama?.idPropio ? {} : { id: b.id }),
        function: { index: i, name: b.name, arguments: b.input || {} },
      }));
      out.push({ role: "assistant", content: texto, ...(pensamiento ? { thinking: pensamiento } : {}), ...(llamadas.length ? { tool_calls: llamadas } : {}) });
      continue;
    }
    // turno de usuario: cada tool_result es un mensaje role "tool"; el texto suelto, un mensaje user
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

/**
 * Respuesta de Ollama -> formato interno.
 * @returns {import("../types.js").ModelResponse}
 */
export function desdeOllama(data) {
  const msg = data.message || {};
  // algunos modelos viejos mezclan el razonamiento en el texto; lo separamos
  let texto = msg.content || "";
  let pensamiento = msg.thinking || "";
  texto = texto.replace(/<think>([\s\S]*?)<\/think>/g, (_, t) => { pensamiento += t; return ""; }).trim();

  /** @type {(import("../types.js").TextBlock | import("../types.js").ToolUseBlock)[]} */
  const content = [];
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
  if (pensamiento && content.length) content[0]._ollama = { ...(content[0]._ollama || {}), thinking: pensamiento };
  const pidio = content.some((b) => b.type === "tool_use");
  return {
    content,
    stop_reason: pidio ? "tool_use" : data.done_reason === "length" ? "max_tokens" : "end_turn",
    usage: { input_tokens: data.prompt_eval_count ?? 0, output_tokens: data.eval_count ?? 0 },
  };
}
