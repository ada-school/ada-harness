// Corre una capa de pruebas: node tests/run.js [unit | providers | integration]
// Sin argumento, todas. Funciona igual en Windows, macOS y Linux (no depende de globs del shell).
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const capas = process.argv.slice(2).length ? process.argv.slice(2) : ["unit", "providers", "integration"];

/** @param {string} d @returns {string[]} */
const buscar = (d) => readdirSync(d).flatMap((f) => {
  const p = path.join(d, f);
  return statSync(p).isDirectory() ? buscar(p) : p.endsWith(".test.js") ? [p] : [];
});

const archivos = capas.flatMap((c) => buscar(path.join(dir, c)));
if (!archivos.length) { console.error(`Sin pruebas en: ${capas.join(", ")}`); process.exit(1); }
const r = spawnSync(process.execPath, ["--test", ...archivos], { stdio: "inherit" });
process.exit(r.status ?? 1);
