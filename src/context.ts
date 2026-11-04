// Edit src/context.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Assembles the context window from the layers declared in harness/routing.json.
// Returns the full system prompt and a per-layer report with the token estimate,
// which is what the chat inspector shows.

import { promises as fs, type Dirent } from "node:fs";
import path from "node:path";
import { ROOT, paths } from "./config.js";
import type { Layer, Message, Routing } from "./types.js";

export { ROOT };

/**
 * Cheap estimate: about 4 characters per token in mixed Spanish and English.
 * For exact figures, the inspector shows the real tokens the API returns beside it.
 * @param {unknown} s
 */
export const estimateTokens = (s: unknown): number => Math.ceil((typeof s === "string" ? s : JSON.stringify(s)).length / 4);

/** @returns {Promise<import("./types.js").Routing>} */
export async function loadRouting(): Promise<Routing> {
  return JSON.parse(await fs.readFile(paths.routing, "utf8"));
}

/** @param {string} p path relative to the repo root, or absolute @returns {Promise<string>} */
async function readIfExists(p: string): Promise<string> {
  try { return await fs.readFile(path.resolve(ROOT, p), "utf8"); } catch { return ""; }
}

/**
 * Reads simple YAML frontmatter (one key per line). Accepts Windows line endings and a BOM.
 * @param {string} txt
 * @returns {Record<string, string>}
 */
export function frontmatter(txt: string): Record<string, string> {
  const m = txt.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out: Record<string, string> = {};
  const body = m?.[1];
  if (body !== undefined) for (const line of body.split(/\r?\n/)) { const i = line.indexOf(":"); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return out;
}

/**
 * The text without its frontmatter: what an agent receives as its prompt.
 * @param {string} txt
 */
export function sinFrontmatter(txt: string): string {
  return txt.replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/**
 * Agent index (decision 0008): name and description of each agent routing.json declares.
 * The body of its file enters only when that agent is spawned, as its system prompt.
 * @param {import("./types.js").Routing} routing
 * @returns {Promise<{ name: string, description: string }[]>}
 */
export async function agentsIndex(routing: Routing): Promise<{ name: string; description: string }[]> {
  const indice: { name: string; description: string }[] = [];
  for (const nombre of Object.keys(routing.agents || {})) {
    const fm = frontmatter(await readIfExists(`harness/agents/${nombre}.md`));
    indice.push({ name: fm.name || nombre, description: fm.description || "" });
  }
  return indice;
}

/**
 * Skills index: name and description only. The body enters through load_skill.
 * @param {string} dir relative to the root
 */
export async function skillsIndex(dir: string): Promise<string> {
  const abs = path.join(ROOT, dir);
  let entries: Dirent[] = [];
  try { entries = await fs.readdir(abs, { withFileTypes: true }); } catch { return ""; }
  const lines: string[] = [];
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
 * Memory index: path and description of each file in paths.memory/areas (ADA_MEMORY moves it).
 * @returns {Promise<string>}
 */
export async function memoryIndex(): Promise<string> {
  const abs = path.join(paths.memory, "areas");
  let files: string[] = [];
  try { files = (await fs.readdir(abs)).filter((f) => f.endsWith(".md")); } catch { return ""; }
  const lines: string[] = [];
  for (const f of files) {
    const fm = frontmatter(await readIfExists(path.join(abs, f)));
    lines.push(`- areas/${f}: ${fm.description || ""}`);
  }
  return lines.length ? "Memoria por tema (lee con read_memory si la conversación lo toca):\n" + lines.join("\n") : "Memoria por tema: (vacía)";
}

/**
 * Builds the system prompt. Each block is a layer; the report says how much each one weighs.
 * @param {{ routing: import("./types.js").Routing, agentName?: string | null }} args
 * @returns {Promise<{ system: string, layers: import("./types.js").Layer[] }>}
 */
export async function assembleSystem({ routing, agentName = null }: { routing: Routing; agentName?: string | null }): Promise<{ system: string; layers: Layer[] }> {
  const layers: { name: string; tokens: number; text: string }[] = [];
  const add = (name: string, text: string) => { if (text && text.trim()) layers.push({ name, tokens: estimateTokens(text), text }); };

  if (agentName) {
    // A subagent starts with its own prompt and the project guide. Nothing else.
    add("system (agente: " + agentName + ")", sinFrontmatter(await readIfExists(`harness/agents/${agentName}.md`)));
    add("projectGuide", await readIfExists(routing.layers.projectGuide.source));
  } else {
    add("system", await readIfExists(routing.layers.system.source));
    add("projectGuide", await readIfExists(routing.layers.projectGuide.source));
    add("skillsIndex", await skillsIndex(routing.layers.skillsIndex.source));
    const core: string[] = [];
    for (const nombre of ["profile.md", "preferences.md"]) core.push(await readIfExists(path.join(paths.memory, nombre)));
    add("memoryCore", core.filter(Boolean).join("\n\n"));
    add("memoryIndex", await memoryIndex());
  }

  const system = layers.map((l) => `<${l.name.split(" ")[0]}>\n${l.text.trim()}\n</${l.name.split(" ")[0]}>`).join("\n\n");
  return { system, layers: layers.map(({ name, tokens }) => ({ name, tokens })) };
}

/**
 * History report: how much each kind of block in messages weighs.
 * @param {import("./types.js").Message[]} messages
 * @returns {import("./types.js").Layer[]}
 */
export function historyReport(messages: Message[]): Layer[] {
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
