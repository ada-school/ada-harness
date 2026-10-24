// Modo terminal: un turno sin interfaz.
//   node src/cli.js [--anthropic | --gemini | --ollama] [--model=nombre] "mensaje"
// (node src/harness.js acepta lo mismo y delega aquí)

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./config.js";

/**
 * @param {string[]} argv argumentos sin "node" ni el nombre del script
 * @returns {{ provider?: string, model?: string, message: string }}
 */
export function parseArgs(argv) {
  const flag = argv.find((a) => a.startsWith("--") && !a.startsWith("--model="));
  const model = argv.find((a) => a.startsWith("--model="))?.slice("--model=".length);
  const message = argv.filter((a) => !a.startsWith("--")).join(" ") || "Lista los archivos del workspace y dime qué hay.";
  return { provider: flag?.slice(2), model, message };
}

/**
 * Recibe `turn` como parámetro para no importar harness.js: así `node src/harness.js` puede
 * delegar aquí sin crear un ciclo de imports.
 * @param {string[]} argv
 * @param {typeof import("./harness.js").turn} turn
 */
export async function main(argv, turn) {
  loadEnvFile();
  const { provider, model, message } = parseArgs(argv);
  try {
    const { text, trace } = await turn({ history: [], userText: message, provider, model });
    console.log(text);
    console.error(`\n[${trace.provider} · ${trace.model} · ${trace.calls} llamadas, ${trace.tools.length} herramientas]`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { turn } = await import("./harness.js");
  await main(process.argv.slice(2), turn);
}
