// El comando del proyecto: chat, un turno, o el peso de las capas.
//   node bin/ada.js                         abre el chat
//   node bin/ada.js run [--anthropic | --gemini | --ollama] [--model=nombre] "mensaje"
//   node bin/ada.js capas
// node src/harness.js y node src/server.js delegan aquí.
// parseArgs de node:util. Un paquete de CLI solo si los subcomandos dejan de compartir opciones.

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs as parseArgsNativo } from "node:util";
import { fileURLToPath } from "node:url";
import { loadEnvFile, ROOT } from "./config.js";

const PROVEEDORES = ["anthropic", "gemini", "ollama"];
const COMANDOS = ["serve", "run", "capas"];
const MENSAJE_EJEMPLO = "Lista los archivos del workspace y dime qué hay.";

/** @type {import("node:util").ParseArgsOptionsConfig} */
const OPCIONES = {
  anthropic: { type: "boolean" },
  gemini: { type: "boolean" },
  ollama: { type: "boolean" },
  model: { type: "string" },
  capas: { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  port: { type: "string" },
  host: { type: "string" },
};

/**
 * @typedef {object} CliArgs
 * @property {"serve" | "run" | "capas"} command
 * @property {string | undefined} provider
 * @property {string | undefined} model
 * @property {string} message
 * @property {boolean} capas
 * @property {boolean} help
 * @property {boolean} version
 * @property {string | undefined} port
 * @property {string | undefined} host
 * @property {string | undefined} error
 */

/**
 * @param {Partial<CliArgs>} [parcial]
 * @returns {CliArgs}
 */
function base(parcial = {}) {
  return {
    command: "run", provider: undefined, model: undefined, message: "",
    capas: false, help: false, version: false, port: undefined, host: undefined, error: undefined,
    ...parcial,
  };
}

/**
 * Traduce el error de parseArgs a una frase corta.
 * @param {unknown} fallo
 * @returns {string}
 */
function errorDeArgs(fallo) {
  const texto = fallo instanceof Error ? fallo.message : String(fallo);
  const desconocida = texto.match(/Unknown option '([^']+)'/);
  if (desconocida) return `opción desconocida: ${desconocida[1]}`;
  const falta = texto.match(/Option '([^']+)' argument missing/);
  if (falta) return `falta el valor de ${falta[1]}`;
  return texto;
}

/**
 * Lee los argumentos del comando. Sin subcomando, `defaultCommand` decide: el bin abre el chat
 * y `node src/harness.js` corre un turno.
 * @param {string[]} argv argumentos sin "node" ni el nombre del script
 * @param {{ defaultCommand?: "serve" | "run" }} [opciones]
 * @returns {CliArgs}
 */
export function parseArgs(argv, { defaultCommand = "run" } = {}) {
  let values;
  /** @type {string[]} */
  let positionals;
  try {
    ({ values, positionals } = parseArgsNativo({ args: argv, options: OPCIONES, strict: true, allowPositionals: true }));
  } catch (fallo) {
    return base({ error: errorDeArgs(fallo) });
  }

  const proveedores = PROVEEDORES.filter((nombre) => values[nombre]);
  if (proveedores.length > 1) return base({ error: "elige un solo proveedor: --anthropic, --gemini o --ollama" });
  const puerto = typeof values.port === "string" ? values.port : undefined;
  const modelo = typeof values.model === "string" ? values.model : undefined;
  const host = typeof values.host === "string" ? values.host : undefined;
  if (values.port !== undefined && (puerto === undefined || !/^\d+$/.test(puerto))) return base({ error: "el puerto tiene que ser un número" });

  const primero = positionals[0];
  const explicito = COMANDOS.includes(primero || "");
  const resto = explicito ? positionals.slice(1) : positionals;
  let command = explicito ? /** @type {"serve" | "run" | "capas"} */ (primero) : defaultCommand;
  if (values.capas || command === "capas") command = "capas";
  else if (!explicito && (resto.length > 0 || proveedores.length > 0 || values.model)) command = "run";

  return base({
    command,
    provider: proveedores[0],
    model: modelo,
    message: resto.join(" ") || (command === "run" ? MENSAJE_EJEMPLO : ""),
    capas: command === "capas",
    help: Boolean(values.help),
    version: Boolean(values.version),
    port: puerto,
    host,
  });
}

/** Texto de `ada --help`. @returns {string} */
export function ayuda() {
  return [
    "ada: el chat y un turno, el mismo comando",
    "",
    "Uso",
    "  ada                          abre el chat",
    "  ada serve [--port N] [--host IP]",
    "  ada run [--anthropic | --gemini | --ollama] [--model NOMBRE] [mensaje]",
    "  ada capas                    peso de las capas, sin llamar a un modelo",
    "  ada --help",
    "  ada --version",
    "",
    "Sin mensaje, run pide un ejemplo: listar el workspace.",
    "npm start, npm run cli y npm run capas llaman a este comando.",
    "node src/server.js y node src/harness.js siguen funcionando.",
  ].join("\n");
}

/** Versión de package.json. @returns {string} */
function versionDelPaquete() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return String(pkg.version);
}

/**
 * Arranca el chat, corre un turno o imprime las capas.
 * Recibe el harness y el servidor como parámetros para no importarlos: así los tres puntos
 * de entrada delegan aquí sin un ciclo de imports.
 * @param {string[]} argv
 * @param {{ turn: typeof import("./harness.js").turn, fixedLayers: typeof import("./harness.js").fixedLayers,
 *           loadRouting: typeof import("./context.js").loadRouting, listen?: typeof import("./server.js").listen,
 *           defaultCommand?: "serve" | "run" }} deps
 */
export async function main(argv, { turn, fixedLayers, loadRouting, listen, defaultCommand = "run" }) {
  loadEnvFile();
  const args = parseArgs(argv, { defaultCommand });
  if (args.error) {
    console.error(args.error);
    console.error("Prueba: ada --help");
    process.exitCode = 1;
    return;
  }
  if (args.help) {
    console.log(ayuda());
    return;
  }
  if (args.version) {
    console.log(versionDelPaquete());
    return;
  }
  if (args.port) process.env.PORT = args.port;
  if (args.host) process.env.ADA_HOST = args.host;
  if (args.command === "capas") {
    const filas = await fixedLayers(await loadRouting());
    console.log("Capas fijas del agente principal, en tokens estimados (4 caracteres por token):");
    for (const c of filas) console.log(`  ${c.name.padEnd(16)} ${String(c.tokens).padStart(6)}`);
    console.log(`  ${"total".padEnd(16)} ${String(filas.reduce((a, c) => a + c.tokens, 0)).padStart(6)}`);
    return;
  }
  if (args.command === "serve") {
    // Quien entra por src/harness.js no puede importar el servidor: api.js importa el harness
    // y el módulo todavía se está evaluando. El chat se abre con bin/ada.js o src/server.js.
    if (!listen) {
      console.error("Para abrir el chat: npm start");
      process.exitCode = 1;
      return;
    }
    listen();
    return;
  }
  try {
    const { text, trace } = await turn({ history: [], userText: args.message, provider: args.provider, model: args.model });
    console.log(text);
    console.error(`\n[${trace.provider} · ${trace.model} · ${trace.calls} llamadas, ${trace.tools.length} herramientas]`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { turn, fixedLayers } = await import("./harness.js");
  const { loadRouting } = await import("./context.js");
  const { listen } = await import("./server.js");
  await main(process.argv.slice(2), { turn, fixedLayers, loadRouting, listen, defaultCommand: "run" });
}
