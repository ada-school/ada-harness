// Workspace temporal: cada prueba que escribe archivos lo hace en una carpeta propia,
// nunca en el workspace/ real del repo.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** @returns {Promise<{ dir: string, cleanup: () => Promise<void> }>} */
export async function tempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ada-harness-"));
  const previo = process.env.ADA_WORKSPACE;
  process.env.ADA_WORKSPACE = dir;
  return {
    dir,
    async cleanup() {
      if (previo === undefined) delete process.env.ADA_WORKSPACE; else process.env.ADA_WORKSPACE = previo;
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Memoria temporal (ADA_MEMORY): las pruebas que escriben memoria no tocan harness/memory/ del repo.
 * Copia profile.md y preferences.md reales para que las capas de memoria se armen igual.
 * @returns {Promise<{ dir: string, cleanup: () => Promise<void> }>}
 */
export async function tempMemory() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ada-memoria-"));
  const repo = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "harness", "memory");
  for (const f of ["profile.md", "preferences.md"]) await fs.copyFile(path.join(repo, f), path.join(dir, f));
  await fs.mkdir(path.join(dir, "areas"));
  const previo = process.env.ADA_MEMORY;
  process.env.ADA_MEMORY = dir;
  return {
    dir,
    async cleanup() {
      if (previo === undefined) delete process.env.ADA_MEMORY; else process.env.ADA_MEMORY = previo;
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/** Deja el entorno sin claves ni proveedor por defecto, como una máquina recién clonada. */
export function cleanEnv() {
  for (const k of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "ADA_PROVIDER", "ADA_OLLAMA_MODEL", "ADA_OLLAMA_FAST_MODEL", "ADA_OLLAMA_NUM_CTX"]) delete process.env[k];
}
