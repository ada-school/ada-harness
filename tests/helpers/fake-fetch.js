// Replaces fetch with an ordered list of responses and stores each request so it can be checked.
// Ollama detection (/api/tags) fails, as on a machine without Ollama.

/** @param {any[]} respuestas JSON bodies each call will return, in order */
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
