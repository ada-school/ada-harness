// Reemplaza fetch por una lista de respuestas en orden y guarda cada pedido para revisarlo.
// La detección de Ollama (/api/tags) falla, como en una máquina sin Ollama.

/** @param {any[]} respuestas cuerpos JSON que devolverá cada llamada, en orden */
export function fakeFetch(respuestas) {
  /** @type {{ url: string, headers: any, body: any }[]} */
  const pedidos = [];
  const original = globalThis.fetch;
  globalThis.fetch = /** @type {any} */ (async (url, opt) => {
    if (String(url).includes("/api/tags")) throw new TypeError("fetch failed");
    pedidos.push({ url: String(url), headers: opt.headers, body: JSON.parse(opt.body) });
    const r = respuestas.shift();
    if (!r) throw new Error("la simulación se quedó sin respuestas");
    return { ok: true, status: 200, json: async () => r };
  });
  return { pedidos, restore: () => { globalThis.fetch = original; } };
}
