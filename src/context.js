// Ensambla la ventana de contexto a partir de las capas declaradas en harness/routing.json.
// Devuelve el system prompt completo y un reporte por capa con el estimado de tokens,
// que es lo que el inspector del chat muestra.

import { promises as fs } from "node:fs";
import path from "node:path";
import { ROOT, paths } from "./config.js";

export { ROOT };

/**
 * Estimación barata: ~4 caracteres por token en español e inglés mezclados.
 * Para cifras exactas, el inspector muestra al lado los tokens reales que devuelve la API.
 * @param {unknown} s
 */
export const estimateTokens = (s) => Math.ceil((typeof s === "string" ? s : JSON.stringify(s)).length / 4);

/** @returns {Promise<import("./types.js").Routing>} */
export async function loadRouting() {
  return JSON.parse(await fs.readFile(paths.routing, "utf8"));
}

/** @param {string} p ruta relativa a la raíz del repo */
async function readIfExists(p) {
  try { return await fs.readFile(path.join(ROOT, p), "utf8"); } catch { return ""; }
}

/**
 * Lee el frontmatter YAML simple (una clave por línea). Acepta saltos de línea de Windows y BOM.
 * @param {string} txt
 * @returns {Record<string, string>}
 */
export function frontmatter(txt) {
  const m = txt.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  /** @type {Record<string, string>} */
  const out = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const i = line.indexOf(":"); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return out;
}

/**
 * Índice de skills: solo name + description. El cuerpo entra con load_skill.
 * @param {string} dir relativa a la raíz
 */
export async function skillsIndex(dir) {
  const abs = path.join(ROOT, dir);
  let entries = [];
  try { entries = await fs.readdir(abs, { withFileTypes: true }); } catch { return ""; }
  const lines = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const txt = await readIfExists(path.join(dir, e.name, "SKILL.md"));
    if (!txt) continue;
    const fm = frontmatter(txt);
    lines.push(`- ${fm.name || e.name}: ${fm.description || "(sin descripción)"}`);
  }
  return lines.length ? "Skills disponibles (carga el contenido con load_skill cuando la tarea coincida):\n" + lines.join("\n") : "";
}

/**
 * Índice de memoria: ruta + description de cada archivo en areas/.
 * @param {string} dir relativa a la raíz
 */
export async function memoryIndex(dir) {
  const abs = path.join(ROOT, dir);
  let files = [];
  try { files = (await fs.readdir(abs)).filter((f) => f.endsWith(".md")); } catch { return ""; }
  const lines = [];
  for (const f of files) {
    const fm = frontmatter(await readIfExists(path.join(dir, f)));
    lines.push(`- areas/${f}: ${fm.description || ""}`);
  }
  return lines.length ? "Memoria por tema (lee con read_memory si la conversación lo toca):\n" + lines.join("\n") : "Memoria por tema: (vacía)";
}

/**
 * Construye el system prompt. Cada bloque es una capa; el reporte dice cuánto pesa cada una.
 * @param {{ routing: import("./types.js").Routing, agentName?: string | null }} args
 * @returns {Promise<{ system: string, layers: import("./types.js").Layer[] }>}
 */
export async function assembleSystem({ routing, agentName = null }) {
  /** @type {{ name: string, tokens: number, text: string }[]} */
  const layers = [];
  const add = (name, text) => { if (text && text.trim()) layers.push({ name, tokens: estimateTokens(text), text }); };

  if (agentName) {
    // Un subagente arranca con su propio prompt y la guía del proyecto. Nada más.
    add("system (agente: " + agentName + ")", await readIfExists(`harness/agents/${agentName}.md`));
    add("projectGuide", await readIfExists(routing.layers.projectGuide.source));
  } else {
    add("system", await readIfExists(routing.layers.system.source));
    add("projectGuide", await readIfExists(routing.layers.projectGuide.source));
    add("skillsIndex", await skillsIndex(routing.layers.skillsIndex.source));
    const core = [];
    for (const p of routing.layers.memoryCore.source) core.push(await readIfExists(p));
    add("memoryCore", core.filter(Boolean).join("\n\n"));
    add("memoryIndex", await memoryIndex(routing.layers.memoryIndex.source));
  }

  const system = layers.map((l) => `<${l.name.split(" ")[0]}>\n${l.text.trim()}\n</${l.name.split(" ")[0]}>`).join("\n\n");
  return { system, layers: layers.map(({ name, tokens }) => ({ name, tokens })) };
}

/**
 * Reporte del historial: cuánto pesa cada tipo de bloque en messages.
 * @param {import("./types.js").Message[]} messages
 * @returns {import("./types.js").Layer[]}
 */
export function historyReport(messages) {
  const acc = { user: 0, assistant: 0, toolResults: 0 };
  for (const m of messages) {
    if (typeof m.content === "string") { acc[m.role] += estimateTokens(m.content); continue; }
    for (const b of m.content) {
      if (b.type === "tool_result") acc.toolResults += estimateTokens(b.content ?? "");
      else acc[m.role] += estimateTokens(b.type === "text" ? b.text : b.input ?? "");
    }
  }
  return [
    { name: "history (user)", tokens: acc.user },
    { name: "history (assistant)", tokens: acc.assistant },
    { name: "toolResults", tokens: acc.toolResults },
  ];
}
