// Registro de herramientas.
// Cada herramienta es dos cosas: una definición JSON (lo único que el modelo ve)
// y una función (lo que el harness ejecuta cuando el modelo "pide" la herramienta).
// El modelo nunca ejecuta nada. Propone. Esto ejecuta.

import { promises as fs } from "node:fs";
import dns from "node:dns";
import net from "node:net";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { paths, isProtected } from "../../src/config.js";

const exec = promisify(execFile);

/**
 * Resuelve `p` dentro de `base` y falla si se sale. Compara carpetas completas, no prefijos de
 * texto: "workspace-otro" empieza con "workspace" pero está afuera.
 * @param {string} base carpeta permitida, absoluta
 * @param {string} p ruta pedida por el modelo
 */
export function inside(base, p) {
  const abs = path.resolve(base, p);
  const rel = path.relative(base, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Ruta fuera de ${path.basename(base)}/: ${p}`);
  return abs;
}

/**
 * Rutas que empiezan con "/" se leen desde la raíz del repo; el resto, desde el workspace.
 * Los secretos (.env) y la carpeta .git nunca se leen: lo que el modelo lee viaja a su proveedor.
 * Vale también dentro del workspace, que con ADA_WORKSPACE puede ser un proyecto real.
 * @param {string} p
 */
export function resolveReadable(p) {
  const base = p.startsWith("/") ? paths.root : paths.workspace;
  const abs = inside(base, p.replace(/^\/+/, "") || ".");
  if (isProtected(path.relative(base, abs))) throw new Error(`Archivo protegido: ${p}`);
  return abs;
}

/**
 * Dónde puede escribir el agente: dentro del workspace y nunca sobre .env ni .git.
 * @param {string} p
 */
export function resolveWritable(p) {
  const abs = inside(paths.workspace, p);
  if (isProtected(path.relative(paths.workspace, abs))) throw new Error(`Archivo protegido: ${p}`);
  return abs;
}

/**
 * Rechaza enlaces simbólicos en cada tramo existente, además de validar la ruta léxica.
 * No sustituye un sandbox del sistema operativo ni protege frente a cambios concurrentes.
 * @param {string} base
 * @param {string} abs
 * @param {{ createBase?: boolean }} [opts]
 * @returns {Promise<string>}
 */
async function rejectSymlinkTraversal(base, abs, { createBase = false } = {}) {
  if (createBase) await fs.mkdir(base, { recursive: true });
  const root = await fs.realpath(base);
  const relative = path.relative(path.resolve(base), abs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Ruta fuera de la carpeta permitida");
  let current = path.resolve(base);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error(`Ruta atraviesa un enlace simbólico: ${current}`);
      const real = await fs.realpath(current);
      const rel = path.relative(root, real);
      if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Ruta fuera de la carpeta permitida");
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") break;
      throw error;
    }
  }
  return abs;
}

/**
 * @param {string} base
 * @param {string} p
 * @param {{ createBase?: boolean }} [opts]
 * @returns {Promise<string>}
 */
async function confined(base, p, opts) {
  const abs = inside(base, p);
  if (isProtected(path.relative(base, abs))) throw new Error(`Archivo protegido: ${p}`);
  return rejectSymlinkTraversal(base, abs, opts);
}

/** @param {string} p */
async function readablePath(p) {
  const base = p.startsWith("/") ? paths.root : paths.workspace;
  return rejectSymlinkTraversal(base, resolveReadable(p));
}

/** @param {string} p */
async function writablePath(p) {
  return rejectSymlinkTraversal(paths.workspace, resolveWritable(p), { createBase: true });
}

/**
 * ¿Es una dirección de esta máquina o de una red privada? (loopback, 10/8, 172.16/12, 192.168/16,
 * 169.254/16 de metadatos de nube, 100.64/10, y sus equivalentes en IPv6)
 * @param {string} ip
 * @returns {boolean}
 */
export function esDireccionInterna(ip) {
  const v = ip.toLowerCase();
  if (net.isIPv6(v)) {
    if (v.startsWith("::ffff:")) return esDireccionInterna(v.slice(7));
    return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = v.split(".").map(Number);
  return a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * web_fetch solo sale a internet (decisión 0006): http o https, y un host que no resuelva a esta
 * máquina ni a la red interna. Una página leída no puede llevar al agente a tu router ni a tu API local.
 * @param {string} texto
 * @returns {Promise<URL>}
 */
export async function urlPublica(texto) {
  let url;
  try { url = new URL(texto); } catch { throw new Error(`URL no permitida: ${texto}`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`URL no permitida: ${texto}`);
  const nombre = url.hostname.replace(/^\[|\]$/g, "");
  const ips = net.isIP(nombre) ? [nombre] : (await dns.promises.lookup(nombre, { all: true })).map((d) => d.address);
  if (ips.some(esDireccionInterna)) throw new Error(`URL no permitida, apunta a la red interna: ${texto}`);
  return url;
}

/** @type {Record<string, import("../../src/types.js").Tool>} */
export const tools = {
  list_dir: {
    definition: {
      name: "list_dir",
      description: "Lista archivos y carpetas dentro de workspace/ (o del repo si path empieza con '/'). Úsala antes de leer para no adivinar nombres.",
      input_schema: { type: "object", properties: { path: { type: "string", minLength: 1, maxLength: 512, description: "Ruta relativa a workspace/. '.' para la raíz." } }, required: ["path"], additionalProperties: false },
    },
    async run({ path: p }) {
      const entries = await fs.readdir(await readablePath(p), { withFileTypes: true });
      return entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).join("\n") || "(vacío)";
    },
  },

  read_file: {
    definition: {
      name: "read_file",
      description: "Lee un archivo de texto de workspace/ (o del repo si path empieza con '/'). Devuelve el contenido con números de línea.",
      input_schema: { type: "object", properties: { path: { type: "string", minLength: 1, maxLength: 512 } }, required: ["path"], additionalProperties: false },
    },
    async run({ path: p }) {
      const txt = await fs.readFile(await readablePath(p), "utf8");
      return txt.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n");
    },
  },

  write_file: {
    definition: {
      name: "write_file",
      description: "Crea o sobreescribe un archivo dentro de workspace/. Crea las carpetas que falten.",
      input_schema: { type: "object", properties: { path: { type: "string", minLength: 1, maxLength: 512 }, content: { type: "string", maxLength: 1000000 } }, required: ["path", "content"], additionalProperties: false },
    },
    async run({ path: p, content }) {
      const abs = await writablePath(p);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(await writablePath(p), content, "utf8");
      return `ok, ${Buffer.byteLength(content)} bytes en workspace/${p}`;
    },
  },

  run_command: {
    definition: {
      name: "run_command",
      description: "Ejecuta un comando dentro de workspace/ con un tiempo límite de 60s. Devuelve stdout y stderr. Sin shell: pasa el programa y sus argumentos por separado.",
      input_schema: {
        type: "object",
        properties: { program: { type: "string", minLength: 1, maxLength: 256, description: "ej. node, npm, python3, ls" }, args: { type: "array", items: { type: "string", maxLength: 4096 }, maxItems: 32 } },
        required: ["program"],
        additionalProperties: false,
      },
    },
    async run({ program, args = [] }) {
      try {
        const { stdout, stderr } = await exec(program, args, { cwd: paths.workspace, timeout: 60000, maxBuffer: 1e6 });
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
      input_schema: { type: "object", properties: { url: { type: "string", minLength: 8, maxLength: 2048 } }, required: ["url"], additionalProperties: false },
    },
    async run({ url }) {
      // las redirecciones se siguen a mano para revisar cada destino
      let destino = await urlPublica(url);
      let res;
      for (let saltos = 0; ; saltos++) {
        res = await fetch(destino, { headers: { "user-agent": "ada-harness/0.1" }, redirect: "manual" });
        const siguiente = res.status >= 300 && res.status < 400 && res.headers.get("location");
        if (!siguiente) break;
        if (saltos === 4) throw new Error(`demasiadas redirecciones: ${url}`);
        destino = await urlPublica(new URL(siguiente, destino).href);
      }
      const html = await res.text();
      return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 20000);
    },
  },

  load_skill: {
    definition: {
      name: "load_skill",
      description: "Carga el contenido completo de un skill del índice. Úsalo cuando la tarea coincide con la descripción del skill.",
      input_schema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 64 } }, required: ["name"], additionalProperties: false },
    },
    async run({ name }) {
      return await fs.readFile(await confined(paths.skills, path.join(name, "SKILL.md")), "utf8");
    },
  },

  read_memory: {
    definition: {
      name: "read_memory",
      description: "Lee un archivo de memoria del índice (ej. areas/mi-proyecto.md).",
      input_schema: { type: "object", properties: { path: { type: "string", minLength: 1, maxLength: 512 } }, required: ["path"], additionalProperties: false },
    },
    async run({ path: p }) {
      return await fs.readFile(await confined(paths.memory, p), "utf8");
    },
  },

  write_memory: {
    definition: {
      name: "write_memory",
      description: "Crea o reemplaza un archivo de memoria en areas/. Solo hechos que el usuario dijo o decisiones tomadas, una línea por hecho con el prefijo '- [stated]'. Incluye frontmatter con name y description.",
      input_schema: { type: "object", properties: { path: { type: "string", minLength: 1, maxLength: 512, description: "ej. areas/mi-proyecto.md" }, content: { type: "string", maxLength: 100000 } }, required: ["path", "content"], additionalProperties: false },
    },
    async run({ path: p, content }) {
      if (!p.startsWith("areas/")) return "error: solo se escribe dentro de areas/. profile.md y preferences.md se editan a mano.";
      const base = path.join(paths.memory, "areas");
      const rel = p.slice("areas/".length);
      const abs = await confined(base, rel, { createBase: true });
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(await confined(base, rel), content, "utf8");
      return `ok, memoria guardada en ${p}`;
    },
  },

  // spawn_agent se registra en src/harness.js porque necesita el loop.
};

/**
 * Definiciones que ve el modelo; con `names`, solo esas (los subagentes ven un subconjunto).
 * @param {string[] | null} [names]
 * @returns {import("../../src/types.js").ToolDefinition[]}
 */
export function definitions(names) {
  return Object.values(tools)
    .filter((t) => !names || names.includes(t.definition.name))
    .map((t) => t.definition);
}
