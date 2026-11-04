// Edit src/config.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Configuration in one place: project paths, environment variables, and loading .env.
// Every module that needs a path imports it from here; nothing else computes ROOT.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root: the folder whose package.json is this harness, whether Node loaded src/ or dist/. */
function repoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
      if (pkg.name === "ada-harness") return dir;
    } catch {
      // This directory is not the package root.
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("ada-harness package.json was not found above the running file");
}

/** Repository root (the folder that contains src/). */
export const ROOT: string = repoRoot();

/** The project folders. Every module that needs a path imports it from here. */
export const paths = {
  root: ROOT,
  harness: path.join(ROOT, "harness"),
  skills: path.join(ROOT, "harness", "skills"),
  agents: path.join(ROOT, "harness", "agents"),
  routing: path.join(ROOT, "harness", "routing.json"),
  app: path.join(ROOT, "app"),
  docs: path.join(ROOT, "docs"),
  /** Folder where the agent reads, writes, and runs. ADA_WORKSPACE points it at another project. */
  get workspace(): string {
    return process.env.ADA_WORKSPACE ? path.resolve(process.env.ADA_WORKSPACE) : path.join(ROOT, "workspace");
  },
  /** The agent's memory folder. ADA_MEMORY splits it from the repo (tests use a temporary one). */
  get memory(): string {
    return process.env.ADA_MEMORY ? path.resolve(process.env.ADA_MEMORY) : path.join(ROOT, "harness", "memory");
  },
};

/** Names no tool reads or writes, in the repo or in the workspace: secrets and git. */
export const PROTECTED: RegExp[] = [/^\.env($|\.)/, /^\.git$/, /^\.sessions$/];

/**
 * Does any segment of the path have a protected name? "api/.env" and ".git/config" do; ".gitignore" does not.
 * @param {string} rel relative path, with / or with \
 */
export function isProtected(rel: string): boolean {
  return rel.split(/[\\/]/).some((parte: string) => PROTECTED.some((re: RegExp) => re.test(parte)));
}

/** Server port (PORT, 3000 by default). */
export const port = (): number => Number(process.env.PORT || 3000);

/**
 * Where the server listens. By default only this machine: the chat runs tools on your
 * disk and should not be open to the workshop network. ADA_HOST=0.0.0.0 opens it on purpose.
 * @returns {string}
 */
export const listenHost = (): string => process.env.ADA_HOST || "127.0.0.1";

/** Is the server open to other machines? */
export const abiertoALaRed = (): boolean => !["127.0.0.1", "localhost", "::1"].includes(listenHost());

/**
 * Loads .env with no dependencies. Variables already in the environment win.
 * Called once when the server or the terminal starts; providers read process.env when they run.
 * @param {string} [file] path of the env file
 */
export function loadEnvFile(file: string = path.join(ROOT, ".env")): void {
  let texto: string;
  try { texto = readFileSync(file, "utf8"); } catch { return; }
  for (const line of texto.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
