// Modo terminal: un turno sin interfaz, o el peso de las capas sin llamar a ningún modelo.
//   node src/cli.js [--anthropic | --gemini | --ollama] [--model=nombre] "mensaje"
//   node src/cli.js --capas        (npm run capas)
// (node src/harness.js acepta lo mismo y delega aquí)

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./config.js";

/**
 * @param {string[]} argv argumentos sin "node" ni el nombre del script
 * @returns {{ provider?: string, model?: string, message: string, capas: boolean }}
 */
export function parseArgs(argv) {
  const flag = argv.find((a) => a.startsWith("--") && !a.startsWith("--model=") && a !== "--capas");
  const model = argv.find((a) => a.startsWith("--model="))?.slice("--model=".length);
  const message = argv.filter((a) => !a.startsWith("--")).join(" ") || "Lista los archivos del workspace y dime qué hay.";
  return { provider: flag?.slice(2), model, message, capas: argv.includes("--capas") };
}

/**
 * Recibe el harness como parámetro para no importarlo: así `node src/harness.js` puede delegar
 * aquí sin crear un ciclo de imports.
 * @param {string[]} argv
 * @param {{ turn: typeof import("./harness.js").turn, fixedLayers: typeof import("./harness.js").fixedLayers,
 *           loadRouting: typeof import("./context.js").loadRouting }} harness
 */
export async function main(argv, { turn, fixedLayers, loadRouting }) {
  loadEnvFile();
  const { provider, model, message, capas } = parseArgs(argv);
  if (capas) {
    const filas = await fixedLayers(await loadRouting());
    console.log("Capas fijas del agente principal, en tokens estimados (4 caracteres por token):");
    for (const c of filas) console.log(`  ${c.name.padEnd(16)} ${String(c.tokens).padStart(6)}`);
    console.log(`  ${"total".padEnd(16)} ${String(filas.reduce((a, c) => a + c.tokens, 0)).padStart(6)}`);
    return;
  }
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
  const { turn, fixedLayers } = await import("./harness.js");
  const { loadRouting } = await import("./context.js");
  await main(process.argv.slice(2), { turn, fixedLayers, loadRouting });
}
