// Servidor HTTP que imita la API de Ollama (/api/tags, /api/show, /api/chat).
// Las pruebas cambian `state` para armar cada escenario.
import http from "node:http";

export async function startFakeOllama() {
  const state = { tags: /** @type {any[]} */ ([]), show: /** @type {Record<string, any>} */ ({}), chats: /** @type {any[]} */ ([]), pedidos: /** @type {any[]} */ ([]) };
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const json = (o, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/api/tags") return json({ models: state.tags });
    if (req.url === "/api/show") return json(state.show[JSON.parse(body).model] || { capabilities: ["completion"] });
    if (req.url === "/api/chat") {
      state.pedidos.push(JSON.parse(body));
      const r = state.chats.shift();
      return r ? json(r) : json({ error: "sin respuestas en la simulación" }, 500);
    }
    json({ error: "ruta" }, 404);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(null)));
  const port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
  return { state, host: `127.0.0.1:${port}`, close: () => new Promise((ok) => server.close(() => ok(null))) };
}

/** Un modelo como lo lista /api/tags. */
export const modelo = (name, caps, extra = {}) => ({ name, model: name, size: 1, details: { parameter_size: "8.2B" }, ...(caps ? { capabilities: caps } : {}), ...extra });

/** Una respuesta de /api/chat. */
export const respuestaChat = (message, extra = {}) => ({ model: "x", message: { role: "assistant", content: "", ...message }, done: true, done_reason: "stop", prompt_eval_count: 900, eval_count: 30, ...extra });
