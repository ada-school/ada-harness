// Configuración en un solo lugar: rutas del proyecto, variables de entorno y carga de .env.
// Todo módulo que necesite una ruta la importa de aquí; nadie más calcula ROOT.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz del repositorio (la carpeta que contiene src/). */
export const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

export const paths = {
  root: ROOT,
  harness: path.join(ROOT, "harness"),
  skills: path.join(ROOT, "harness", "skills"),
  memory: path.join(ROOT, "harness", "memory"),
  agents: path.join(ROOT, "harness", "agents"),
  routing: path.join(ROOT, "harness", "routing.json"),
  app: path.join(ROOT, "app"),
  docs: path.join(ROOT, "docs"),
  /** Carpeta donde el agente lee, escribe y ejecuta. ADA_WORKSPACE la apunta a otro proyecto. */
  get workspace() {
    return process.env.ADA_WORKSPACE ? path.resolve(process.env.ADA_WORKSPACE) : path.join(ROOT, "workspace");
  },
};

/** Nombres que ninguna herramienta lee ni escribe, en el repo ni en el workspace: secretos y git. */
export const PROTECTED = [/^\.env($|\.)/, /^\.git$/];

/**
 * ¿Algún tramo de la ruta tiene un nombre protegido? "api/.env" y ".git/config" sí; ".gitignore" no.
 * @param {string} rel ruta relativa, con / o con \
 */
export function isProtected(rel) {
  return rel.split(/[\\/]/).some((parte) => PROTECTED.some((re) => re.test(parte)));
}

export const port = () => Number(process.env.PORT || 3000);

/**
 * Carga .env sin dependencias. Las variables que ya existen en el entorno tienen prioridad.
 * Se llama una vez al arrancar el servidor o la terminal; los proveedores leen process.env al usarse.
 */
export function loadEnvFile(file = path.join(ROOT, ".env")) {
  let texto;
  try { texto = readFileSync(file, "utf8"); } catch { return; }
  for (const line of texto.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
