// Edit harness/tools/index.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Tool registry.
// Each tool is two things: a JSON definition (the only thing the model sees)
// and a function (what the harness runs when the model "asks" for the tool).
// The model never runs anything. It proposes. This runs.

import { promises as fs, realpathSync } from "node:fs";
import dns from "node:dns";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { paths, isProtected } from "../../src/config.js";
import type { Tool, ToolDefinition } from "../../src/types.js";

const exec = promisify(execFile);

/**
 * Resolves `p` inside `base` and fails if it escapes. Compares whole folders, not text
 * prefixes: "workspace-otro" starts with "workspace" but it is outside.
 * @param {string} base allowed folder, absolute
 * @param {string} p path the model asked for
 */
export function inside(base: string, p: string): string {
  const abs = path.resolve(base, p);
  const rel = path.relative(base, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Ruta fuera de ${path.basename(base)}/: ${p}`);
  return abs;
}

/**
 * Paths that start with "/" are read from the repo root; the rest, from the workspace.
 * Secrets (.env) and the .git folder are never read: what the model reads travels to its provider.
 * This also holds inside the workspace, which with ADA_WORKSPACE can be a real project.
 * @param {string} p
 */
export function resolveReadable(p: string): string {
  const base = p.startsWith("/") ? paths.root : paths.workspace;
  const abs = inside(base, p.replace(/^\/+/, "") || ".");
  if (isProtected(path.relative(base, abs))) throw new Error(`Archivo protegido: ${p}`);
  return abs;
}

/**
 * Where the agent may write: inside the workspace and never over .env or .git.
 * @param {string} p
 */
export function resolveWritable(p: string): string {
  const abs = inside(paths.workspace, p);
  if (isProtected(path.relative(paths.workspace, abs))) throw new Error(`Archivo protegido: ${p}`);
  return abs;
}

/**
 * Rejects symbolic links on every existing segment, besides checking the lexical path.
 * It does not replace an operating-system sandbox and it does not protect against concurrent changes.
 * @param {string} base
 * @param {string} abs
 * @param {{ createBase?: boolean }} [opts]
 * @returns {Promise<string>}
 */
async function rejectSymlinkTraversal(base: string, abs: string, { createBase = false }: { createBase?: boolean } = {}): Promise<string> {
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
      if (error.code === "ENOENT") break;
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
async function confined(base: string, p: string, opts?: { createBase?: boolean }): Promise<string> {
  const abs = inside(base, p);
  if (isProtected(path.relative(base, abs))) throw new Error(`Archivo protegido: ${p}`);
  return rejectSymlinkTraversal(base, abs, opts);
}

/** @param {string} p */
async function readablePath(p: string): Promise<string> {
  const base = p.startsWith("/") ? paths.root : paths.workspace;
  return rejectSymlinkTraversal(base, resolveReadable(p));
}

/** @param {string} p */
async function writablePath(p: string): Promise<string> {
  return rejectSymlinkTraversal(paths.workspace, resolveWritable(p), { createBase: true });
}

/**
 * Is this an address of this machine or of a private network? (loopback, 10/8, 172.16/12, 192.168/16,
 * 169.254/16 cloud metadata, 100.64/10, and their IPv6 equivalents)
 * @param {string} ip
 * @returns {boolean}
 */
export function esDireccionInterna(ip: string): boolean {
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
 * web_fetch only goes out to the internet (decision 0006): http or https, and a host that does not
 * resolve to this machine or the internal network. A page it reads cannot lead the agent to your router or your local API.
 * @param {string} texto
 * @returns {Promise<URL>}
 */
export async function urlPublica(texto: string): Promise<URL> {
  let url: URL;
  try { url = new URL(texto); } catch { throw new Error(`URL no permitida: ${texto}`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`URL no permitida: ${texto}`);
  const nombre = url.hostname.replace(/^\[|\]$/g, "");
  const ips = net.isIP(nombre) ? [nombre] : (await dns.promises.lookup(nombre, { all: true })).map((d) => d.address);
  if (ips.some(esDireccionInterna)) throw new Error(`URL no permitida, apunta a la red interna: ${texto}`);
  return url;
}

/** Roots a command must not read. The workspace, and the program's install prefix, are opened again after this. */
const DENIED_ROOTS = ["/Users", "/private/tmp", "/private/var/folders", "/Volumes"];

/**
 * Seatbelt profile for `run_command`. System libraries stay readable. The user's files do not.
 * The last matching rule wins, so the workspace allow comes after the deny.
 * @param {string} workspace absolute real path of the working folder
 * @param {string | null} prefix install prefix, when it sits under a denied root
 */
function commandProfile(workspace: string, prefix: string | null): string {
  const ws = sbQuote(workspace);
  const extra = prefix ? `\n(allow file-read* (subpath ${sbQuote(prefix)}))` : "";
  return `(version 1)
(deny default)
(import "system.sb")
(allow process*)
(deny file-read* (subpath "/Users") (subpath "/private/tmp") (subpath "/private/var/folders") (subpath "/Volumes"))
(allow file-read* file-write* (subpath ${ws}))${extra}
(deny file-write* (subpath "/"))
(allow file-write* (subpath ${ws}))
`;
}

/** @param {string} p */
function sbQuote(p: string): string {
  if (/[()\\"]/.test(p)) throw new Error(`Ruta no admitida por el sandbox: ${p}`);
  return `"${p}"`;
}

/**
 * Install tree of `program`, when that tree lives under a denied root (nvm, a temp binary).
 * A program in `/bin` or `/usr` needs nothing extra: the system profile already allows it.
 * @param {string} program
 * @returns {string | null}
 */
function installPrefix(program: string): string | null {
  const real = resolveProgram(program);
  if (!real) return null;
  const dir = path.dirname(real);
  let prefix = path.basename(dir) === "bin" ? path.dirname(dir) : dir;
  const home = os.homedir();
  if (prefix === home || prefix.split(path.sep).length <= 3) prefix = dir;
  if (prefix === "/" || prefix === home || DENIED_ROOTS.includes(prefix)) return null;
  if (!DENIED_ROOTS.some((root) => prefix.startsWith(root + path.sep))) return null;
  return prefix;
}

/** @param {string} program @returns {string | null} */
function resolveProgram(program: string): string | null {
  const candidates = program.includes("/") || program.includes("\\")
    ? [program]
    : (process.env.PATH || "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, program));
  for (const candidate of candidates) {
    try { return realpathSync(candidate); } catch { /* next directory on PATH */ }
  }
  return null;
}

/** @type {Record<string, import("../../src/types.js").Tool>} */
export const tools: Record<string, Tool> = {
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
        const cwd = await fs.realpath(paths.workspace);
        // ponytail: macOS Seatbelt, not a container. A Linux image cannot run the host binary, and the tests must not need a daemon. Linux stays a directory plus a timeout until bubblewrap is wired.
        const file = process.platform === "darwin" ? "sandbox-exec" : program;
        const argv = process.platform === "darwin"
          ? ["-p", commandProfile(cwd, installPrefix(program)), program, ...args]
          : args;
        const { stdout, stderr } = await exec(file, argv, { cwd, timeout: 60000, maxBuffer: 1e6 });
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
      // redirects are followed by hand so each destination can be checked
      let destino = await urlPublica(url);
      let res: Awaited<ReturnType<typeof fetch>>;
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

  // spawn_agent is registered in src/harness.ts because it needs the loop.
};

/**
 * Definitions the model sees; with `names`, only those (subagents see a subset).
 * @param {string[] | null} [names]
 * @returns {import("../../src/types.js").ToolDefinition[]}
 */
export function definitions(names?: string[] | null): ToolDefinition[] {
  return Object.values(tools)
    .filter((t) => !names || names.includes(t.definition.name))
    .map((t) => t.definition);
}
