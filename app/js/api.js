// Llamadas al servidor. Todo lo que el chat sabe del harness pasa por aquí.

/** @returns {Promise<any[]>} proveedores con su estado (ver GET /api/providers) */
export async function getProviders() {
  const res = await fetch("/api/providers");
  return (await res.json()).providers;
}

/**
 * Un turno completo. El servidor guarda el historial por sesión.
 * @param {{ session: string, message: string, provider?: string, model?: string }} body
 * @returns {Promise<{ text?: string, trace?: any, reset?: boolean, error?: string }>}
 */
export async function sendMessage(body) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** CU-04.1 El servidor olvida todas las conversaciones. */
export async function resetSessions() {
  await fetch("/api/reset", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
}
