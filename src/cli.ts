// Edit src/cli.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// The project command: chat, one turn, or the weight of the layers.
//   node bin/ada.js                         opens the chat
//   node bin/ada.js run [--anthropic | --gemini | --ollama] [--model=name] "message"
//   node bin/ada.js capas
// The compiled harness and server files under dist/ delegate here. The documented command is npm start.
// parseArgs from node:util. A CLI package only if the subcommands stop sharing options.

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs as parseArgsNativo } from "node:util";
import { fileURLToPath } from "node:url";
import { loadEnvFile, ROOT } from "./config.js";
import { text } from "./text.js";
import type { Layer, Message, Routing, Trace } from "./types.js";

type CliArgs = {
  command: "serve" | "run" | "capas";
  provider: string | undefined;
  model: string | undefined;
  message: string;
  capas: boolean;
  help: boolean;
  version: boolean;
  port: string | undefined;
  host: string | undefined;
  error: string | undefined;
};

const PROVEEDORES = ["anthropic", "gemini", "ollama"];
const COMANDOS = ["serve", "run", "capas"];
const MENSAJE_EJEMPLO = "Lista los archivos del workspace y dime qué hay.";

/** @type {import("node:util").ParseArgsOptionsConfig} */
const OPCIONES: import("node:util").ParseArgsOptionsConfig = {
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
function base(parcial: Partial<CliArgs> = {}): CliArgs {
  return {
    command: "run", provider: undefined, model: undefined, message: "",
    capas: false, help: false, version: false, port: undefined, host: undefined, error: undefined,
    ...parcial,
  };
}

/**
 * Turns a parseArgs error into a short sentence.
 * @param {unknown} fallo
 * @returns {string}
 */
function errorDeArgs(fallo: unknown): string {
  const texto = fallo instanceof Error ? fallo.message : String(fallo);
  const desconocida = texto.match(/Unknown option '([^']+)'/);
  if (desconocida) return text("unknownOption", { name: desconocida[1] });
  const falta = texto.match(/Option '([^']+)' argument missing/);
  if (falta) return text("missingValue", { name: falta[1] });
  return texto;
}

/**
 * Reads the command arguments. With no subcommand, `defaultCommand` decides: the bin opens the chat
 * and the compiled harness file runs one turn.
 * @param {string[]} argv arguments without "node" or the script name
 * @param {{ defaultCommand?: "serve" | "run" }} [opciones]
 * @returns {CliArgs}
 */
export function parseArgs(argv: string[], { defaultCommand = "run" }: { defaultCommand?: "serve" | "run" } = {}): CliArgs {
  let values;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgsNativo({ args: argv, options: OPCIONES, strict: true, allowPositionals: true }));
  } catch (fallo) {
    return base({ error: errorDeArgs(fallo) });
  }

  const proveedores = PROVEEDORES.filter((nombre) => values[nombre]);
  if (proveedores.length > 1) return base({ error: text("oneProvider") });
  const puerto = typeof values.port === "string" ? values.port : undefined;
  const modelo = typeof values.model === "string" ? values.model : undefined;
  const host = typeof values.host === "string" ? values.host : undefined;
  if (values.port !== undefined && (puerto === undefined || !/^\d+$/.test(puerto))) return base({ error: text("badPort") });

  const primero = positionals[0];
  const explicito = COMANDOS.includes(primero || "");
  const resto = explicito ? positionals.slice(1) : positionals;
  let command: CliArgs["command"] = explicito ? (primero as CliArgs["command"]) : defaultCommand;
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

/** Text of `ada --help`. @returns {string} */
export function ayuda(): string {
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
    "npm install y npm start abren el chat.",
  ].join("\n");
}

/** Version from package.json. @returns {string} */
function versionDelPaquete(): string {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return String(pkg.version);
}

/**
 * Starts the chat, runs one turn, or prints the layers.
 * Receives the harness and the server as parameters so it does not import them: the three
 * entry points delegate here without an import cycle.
 * @param {string[]} argv
 * @param {{ turn: typeof import("./harness.js").turn, fixedLayers: typeof import("./harness.js").fixedLayers,
 *           loadRouting: typeof import("./context.js").loadRouting, listen?: typeof import("./server.js").listen,
 *           defaultCommand?: "serve" | "run" }} deps
 */
export async function main(argv: string[], { turn, fixedLayers, loadRouting, listen, defaultCommand = "run" }: {
  turn: (args: {
    history: Message[];
    userText: string;
    provider?: string;
    model?: string;
    onText?: (delta: string) => void;
  }) => Promise<{ text: string; trace: Trace }>;
  fixedLayers: (routing: Routing) => Promise<Layer[]>;
  loadRouting: () => Promise<Routing>;
  listen?: () => unknown;
  defaultCommand?: "serve" | "run";
}): Promise<void> {
  loadEnvFile();
  const args = parseArgs(argv, { defaultCommand });
  if (args.error) {
    console.error(args.error);
    console.error(text("tryHelp"));
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
    // An entry through the harness file cannot import the server: src/http/api.ts imports the harness
    // and the module is still evaluating. The chat opens through bin/ada.js or the compiled server.
    if (!listen) {
      console.error(text("openChat"));
      process.exitCode = 1;
      return;
    }
    listen();
    return;
  }
  try {
    let streamed = false;
    const { text: reply, trace } = await turn({
      history: [],
      userText: args.message,
      provider: args.provider,
      model: args.model,
      onText(delta) {
        streamed = true;
        process.stdout.write(delta);
      },
    });
    if (!streamed) console.log(reply);
    else if (!reply.endsWith("\n")) process.stdout.write("\n");
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
