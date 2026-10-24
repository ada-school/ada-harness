// Registro de herramientas.
// Cada herramienta es dos cosas: una definición JSON (lo único que el modelo ve)
// y una función (lo que el harness ejecuta cuando el modelo "pide" la herramienta).
// El modelo nunca ejecuta nada. Propone. Esto ejecuta.

import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const WORKSPACE = path.join(ROOT, "workspace");
const MEMORY = path.join(ROOT, "harness", "memory");
const SKILLS = path.join(ROOT, "harness", "skills");

// Nada sale de la carpeta permitida.
function inside(base, p) {
  const abs = path.resolve(base, p);
  if (!abs.startsWith(base)) throw new Error(`Ruta fuera de ${path.basename(base)}/: ${p}`);
  return abs;
}

export const tools = {
  list_dir: {
    definition: {
      name: "list_dir",
      description: "Lista archivos y carpetas dentro de workspace/ (o del repo si path empieza con '/'). Úsala antes de leer para no adivinar nombres.",
      input_schema: { type: "object", properties: { path: { type: "string", description: "Ruta relativa a workspace/. '.' para la raíz." } }, required: ["path"] },
    },
    async run({ path: p }) {
      const base = p.startsWith("/") ? ROOT : WORKSPACE;
      const abs = inside(base, p.replace(/^\//, "") || ".");
      const entries = await fs.readdir(abs, { withFileTypes: true });
      return entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).join("\n") || "(vacío)";
    },
  },

  read_file: {
    definition: {
      name: "read_file",
      description: "Lee un archivo de texto de workspace/ (o del repo si path empieza con '/'). Devuelve el contenido con números de línea.",
      input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
    async run({ path: p }) {
      const base = p.startsWith("/") ? ROOT : WORKSPACE;
      const abs = inside(base, p.replace(/^\//, ""));
      const txt = await fs.readFile(abs, "utf8");
      return txt.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n");
    },
  },

  write_file: {
    definition: {
      name: "write_file",
      description: "Crea o sobreescribe un archivo dentro de workspace/. Crea las carpetas que falten.",
      input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    },
    async run({ path: p, content }) {
      const abs = inside(WORKSPACE, p);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
      return `ok, ${Buffer.byteLength(content)} bytes en workspace/${p}`;
    },
  },

  run_command: {
    definition: {
      name: "run_command",
      description: "Ejecuta un comando dentro de workspace/ con un tiempo límite de 60s. Devuelve stdout y stderr. Sin shell: pasa el programa y sus argumentos por separado.",
      input_schema: {
        type: "object",
        properties: { program: { type: "string", description: "ej. node, npm, python3, ls" }, args: { type: "array", items: { type: "string" } } },
        required: ["program"],
      },
    },
    async run({ program, args = [] }) {
      try {
        const { stdout, stderr } = await exec(program, args, { cwd: WORKSPACE, timeout: 60000, maxBuffer: 1e6 });
        return (stdout + (stderr ? "\n[stderr]\n" + stderr : "")).trim() || "(sin salida)";
      } catch (e) {
        return `error (${e.code ?? "?"}): ${e.stderr || e.message}`;
      }
    },
  },

  web_fetch: {
    definition: {
      name: "web_fetch",
      description: "Descarga una URL pública y devuelve su texto (HTML sin etiquetas, recortado a 20.000 caracteres).",
      input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
    async run({ url }) {
      const res = await fetch(url, { headers: { "user-agent": "ada-harness/0.1" } });
      const html = await res.text();
      return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 20000);
    },
  },

  load_skill: {
    definition: {
      name: "load_skill",
      description: "Carga el contenido completo de un skill del índice. Úsalo cuando la tarea coincide con la descripción del skill.",
      input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
    async run({ name }) {
      const abs = inside(SKILLS, path.join(name, "SKILL.md"));
      return await fs.readFile(abs, "utf8");
    },
  },

  read_memory: {
    definition: {
      name: "read_memory",
      description: "Lee un archivo de memoria del índice (ej. areas/mi-proyecto.md).",
      input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
    async run({ path: p }) {
      return await fs.readFile(inside(MEMORY, p), "utf8");
    },
  },

  write_memory: {
    definition: {
      name: "write_memory",
      description: "Crea o reemplaza un archivo de memoria en areas/. Solo hechos que el usuario dijo o decisiones tomadas, una línea por hecho con el prefijo '- [stated]'. Incluye frontmatter con name y description.",
      input_schema: { type: "object", properties: { path: { type: "string", description: "ej. areas/mi-proyecto.md" }, content: { type: "string" } }, required: ["path", "content"] },
    },
    async run({ path: p, content }) {
      if (!p.startsWith("areas/")) return "error: solo se escribe dentro de areas/. profile.md y preferences.md se editan a mano.";
      const abs = inside(MEMORY, p);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
      return `ok, memoria guardada en ${p}`;
    },
  },

  // spawn_agent se registra en src/harness.js porque necesita el loop.
};

export function definitions(names) {
  return Object.values(tools)
    .filter((t) => !names || names.includes(t.definition.name))
    .map((t) => t.definition);
}
