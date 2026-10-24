// Carga .env si existe, sin dependencias. Lo importan el servidor y el modo terminal.
// Las variables que ya existen en el entorno tienen prioridad sobre las del archivo.

import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./context.js";

try {
  const env = readFileSync(path.join(ROOT, ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
