// Workspace temporal: cada prueba que escribe archivos lo hace en una carpeta propia,
// nunca en el workspace/ real del repo.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

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

/** Deja el entorno sin claves ni proveedor por defecto, como una máquina recién clonada. */
export function cleanEnv() {
  for (const k of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "ADA_PROVIDER", "ADA_OLLAMA_MODEL", "ADA_OLLAMA_FAST_MODEL", "ADA_OLLAMA_NUM_CTX"]) delete process.env[k];
}
