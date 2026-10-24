// Utilidades de presentación, sin DOM.

/** @param {number} n */
export const num = (n) => Number(n || 0).toLocaleString("es-CO");

/** Color de cada capa: el mismo del explicador y de styles.css. */
const COLORES = {
  system: "--l-sys", projectGuide: "--l-route", skillsIndex: "--l-skill", memoryCore: "--l-mem",
  memoryIndex: "--l-mem", toolDefinitions: "--l-tools", "history (user)": "--l-user",
  "history (assistant)": "--model", toolResults: "--l-res",
};

/**
 * "system (agente: reviewer)" usa el color de "system".
 * @param {string} capa
 */
export const colorDeCapa = (capa) => COLORES[capa] || COLORES[capa.split(" (")[0]] || "--fg2";
