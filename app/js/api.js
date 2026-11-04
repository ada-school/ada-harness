// Llamadas al servidor. Todo lo que el chat sabe del harness pasa por aquí.

/** @returns {Promise<any[]>} proveedores con su estado (ver GET /api/providers) */
export async function getProviders() {
  const res = await fetch("/api/providers");
  return (await res.json()).providers;
}

/**
 * One turn. The server keeps the history for the session.
 * Asks for the reply as a stream. A refusal still comes back as JSON.
 * @param {{ session: string, message: string, provider?: string, model?: string }} body
 * @returns {Promise<Response>}
 */
export async function sendMessage(body) {
  return fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
}

/** CU-04.1 El servidor olvida todas las conversaciones. */
export async function resetSessions() {
  await fetch("/api/reset", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
}
