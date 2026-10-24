// Selector de modelo. La parte pura (qué opciones hay y cuál elegir) se prueba en Node;
// renderSelector() es lo único que toca el DOM.

/**
 * @typedef {{ value?: string, label: string, disabled: boolean }} Opcion
 * @typedef {{ label?: string, options: Opcion[] }} Grupo
 */

/**
 * Proveedores -> grupos de opciones. Claude y Gemini: una opción cada uno.
 * Ollama: un grupo con cada modelo instalado, marcado local, nube o sin herramientas.
 * El valor de cada opción es "proveedor|modelo".
 * @param {any[]} providers respuesta de GET /api/providers
 * @returns {Grupo[]}
 */
export function buildOptions(providers) {
  /** @type {Grupo[]} */
  const grupos = [{ options: [] }];
  for (const p of providers) {
    if (p.name !== "ollama") {
      grupos[0].options.push({
        value: `${p.name}|`,
        label: `${p.label} · ${p.model}${p.configured ? "" : ` (falta ${p.keyEnv})`}`,
        disabled: !p.configured,
      });
      continue;
    }
    const st = p.status || { models: [] };
    /** @type {Opcion[]} */
    const opciones = [];
    if (!st.detected) opciones.push({ label: 'No detectado: instala Ollama y corre "ollama serve"', disabled: true });
    else if (!st.models.length) opciones.push({ label: "Sin modelos: ollama pull qwen3:8b", disabled: true });
    for (const m of st.models || []) {
      const etiqueta = !m.tools ? "no usa herramientas" : m.remote ? "nube, requiere cuenta" : "local, gratis";
      opciones.push({ value: `ollama|${m.name}`, label: `${m.name}${m.params ? " · " + m.params : ""} (${etiqueta})`, disabled: !m.tools });
    }
    grupos.push({ label: `Ollama · ${st.host || ""}`, options: opciones });
  }
  return grupos;
}

/** CU-02.7 Lo que dice la conversación cuando pickSelection() no encuentra ningún modelo. */
export const SIN_MODELOS = "Ningún modelo disponible. Agrega una clave en .env, o instala Ollama y descarga un modelo: ollama pull qwen3:8b";

/**
 * Qué opción queda elegida: la actual, la guardada, la que el servidor marca por defecto, o la primera.
 * @param {{ grupos: Grupo[], providers: any[], current?: string | null, saved?: string | null }} p
 */
export function pickSelection({ grupos, providers, current, saved }) {
  const validas = grupos.flatMap((g) => g.options).filter((o) => !o.disabled && o.value).map((o) => /** @type {string} */ (o.value));
  const def = providers.find((p) => p.default);
  const porDefecto = def ? (def.name === "ollama" ? `ollama|${def.model}` : `${def.name}|`) : "";
  return [current, saved, porDefecto].find((v) => v && validas.includes(v)) || validas[0] || null;
}

/**
 * "ollama|qwen3:8b" -> { provider: "ollama", model: "qwen3:8b" }; "gemini|" -> { provider: "gemini" }
 * @param {string} value
 */
export function parseSelection(value) {
  const i = value.indexOf("|");
  const provider = i < 0 ? value : value.slice(0, i);
  const model = i < 0 ? "" : value.slice(i + 1);
  return { provider, model: model || undefined };
}

/**
 * Dibuja los grupos en el <select>. Usa nodos y textContent: nombres de modelos nunca son HTML.
 * @param {HTMLSelectElement} select
 * @param {Grupo[]} grupos
 */
export function renderSelector(select, grupos) {
  select.replaceChildren(...grupos.flatMap((g) => {
    const opciones = g.options.map((o) => {
      const el = document.createElement("option");
      if (o.value) el.value = o.value;
      el.textContent = o.label;
      el.disabled = o.disabled;
      return el;
    });
    if (!g.label) return opciones;
    const grupo = document.createElement("optgroup");
    grupo.label = g.label;
    grupo.append(...opciones);
    return [grupo];
  }));
}
