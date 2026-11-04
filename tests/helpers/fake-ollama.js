// HTTP server that imitates the Ollama API (/api/tags, /api/show, /api/chat).
// Tests change `state` to set up each scenario.
import http from "node:http";

/**
 * An HTTP server that imitates the Ollama API (/api/tags, /api/show, /api/chat). `state.tags` and
 * `state.chats` define what it answers; `state.pedidos` collects what /api/chat received.
 * @returns {Promise<{ state: any, host: string, close: () => Promise<void> }>}
 */
export async function startFakeOllama() {
  const state = { tags: /** @type {any[]} */ ([]), show: /** @type {Record<string, any>} */ ({}), chats: /** @type {any[]} */ ([]), pedidos: /** @type {any[]} */ ([]) };
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const json = (o, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/api/tags") return json({ models: state.tags });
    if (req.url === "/api/show") return json(state.show[JSON.parse(body).model] || { capabilities: ["completion"] });
    if (req.url === "/api/chat") {
      const pedido = JSON.parse(body);
      state.pedidos.push(pedido);
      const r = state.chats.shift();
      if (!r) return json({ error: "sin respuestas en la simulación" }, 500);
      if (!pedido.stream) return json(r);
      const msg = r.message || {};
      const content = msg.content || "";
      const cut = content.length > 1 ? Math.ceil(content.length / 2) : content.length;
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      const head = content.slice(0, cut);
      if (head) res.write(JSON.stringify({ model: r.model, message: { role: "assistant", content: head }, done: false }) + "\n");
      res.end(JSON.stringify({ ...r, message: { ...msg, content: content.slice(cut) }, done: true }) + "\n");
      return;
    }
    json({ error: "ruta" }, 404);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(null)));
  const port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
  return { state, host: `127.0.0.1:${port}`, close: () => new Promise((ok) => server.close(() => ok())) };
}

/** A model as /api/tags lists it. */
export const modelo = (name, caps, extra = {}) => ({ name, model: name, size: 1, details: { parameter_size: "8.2B" }, ...(caps ? { capabilities: caps } : {}), ...extra });

/** A response from /api/chat. */
export const respuestaChat = (message, extra = {}) => ({ model: "x", message: { role: "assistant", content: "", ...message }, done: true, done_reason: "stop", prompt_eval_count: 900, eval_count: 30, ...extra });
