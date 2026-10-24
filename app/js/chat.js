// La conversación: agregar mensajes y limpiar. Los mensajes van con textContent.

/**
 * @param {HTMLElement} log
 */
export function createLog(log) {
  return {
    /**
     * @param {"u" | "a" | "s"} tipo usuario, asistente o sistema
     * @param {string} texto
     */
    add(tipo, texto) {
      const d = document.createElement("div");
      d.className = `msg ${tipo}`;
      d.textContent = texto;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    },
    clear() { log.replaceChildren(); },
  };
}
