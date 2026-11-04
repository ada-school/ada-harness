// Tools: the sandbox. What the model asks for must never leave its folder or read secrets.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tools, definitions, inside, resolveReadable, resolveWritable } from "../../dist/harness/tools/index.js";
import { paths } from "../../dist/src/config.js";
import { tempWorkspace, tempMemory } from "../helpers/workspace.js";

/** @type {Awaited<ReturnType<typeof tempWorkspace>>} */
let ws;
/** @type {Awaited<ReturnType<typeof tempMemory>>} */
let mem;
before(async () => { ws = await tempWorkspace(); mem = await tempMemory(); });
after(async () => { await ws.cleanup(); await mem.cleanup(); await fs.rm(ws.dir + "-hermano", { recursive: true, force: true }); });

test("inside: acepta rutas dentro de la carpeta", () => {
  assert.equal(inside(ws.dir, "a/b.txt"), path.join(ws.dir, "a", "b.txt"));
  assert.equal(inside(ws.dir, "."), ws.dir);
});

test("inside: bloquea ../, rutas absolutas y carpetas hermanas con el mismo prefijo", async () => {
  await fs.mkdir(ws.dir + "-hermano", { recursive: true });
  const hermana = "../" + path.basename(ws.dir) + "-hermano/x.txt";   // starts with the workspace name
  for (const p of ["../x", "a/../../x", hermana, "/etc/passwd"]) {
    assert.throws(() => inside(ws.dir, p), /Ruta fuera de/, p);
  }
});

test("lectura desde la raíz del repo: permitida, salvo secretos y git", () => {
  assert.equal(resolveReadable("/AGENTS.md"), path.join(paths.root, "AGENTS.md"));
  assert.equal(resolveReadable("/.gitignore"), path.join(paths.root, ".gitignore"));
  for (const p of ["/.env", "/.env.local", "/.git/config", "/.git", "/.sessions/sessions.json"]) {
    assert.throws(() => resolveReadable(p), /Archivo protegido/, p);
  }
  assert.throws(() => resolveReadable("/../fuera.txt"), /Ruta fuera de/);
});

test("workspace: con ADA_WORKSPACE en un proyecto real, su .env y su .git tampoco se tocan", async () => {
  await fs.writeFile(path.join(ws.dir, ".env"), "CLAVE=secreta");
  await assert.rejects(tools.read_file.run({ path: ".env" }), /Archivo protegido/);
  await assert.rejects(tools.write_file.run({ path: ".git/hooks/pre-commit", content: "x" }), /Archivo protegido/);
  for (const p of ["api/.env.local", "sub/.git/config", "/app/.env"]) {
    assert.throws(() => resolveReadable(p), /Archivo protegido/, p);
  }
  assert.throws(() => resolveWritable("api/.env"), /Archivo protegido/);
  for (const p of [".gitignore", ".gitkeep", "docs/.environment.md", ".context/x.txt"]) {
    assert.doesNotThrow(() => resolveReadable(p), p);
  }
});

test("read_file y write_file rechazan escapar por un enlace simbólico", async () => {
  const afuera = ws.dir + "-hermano";
  await fs.mkdir(afuera, { recursive: true });
  await fs.writeFile(path.join(afuera, "secreto.txt"), "secreto externo");
  await fs.symlink(afuera, path.join(ws.dir, "atajo"), "dir");
  await fs.symlink(path.join(afuera, "secreto.txt"), path.join(ws.dir, "link.txt"));
  await assert.rejects(tools.read_file.run({ path: "atajo/secreto.txt" }), /enlace simbólico/);
  await assert.rejects(tools.write_file.run({ path: "atajo/nuevo.txt", content: "x" }), /enlace simbólico/);
  await assert.rejects(tools.list_dir.run({ path: "atajo" }), /enlace simbólico/);
  await assert.rejects(tools.read_file.run({ path: "link.txt" }), /enlace simbólico/);
});

test("read_file y write_file trabajan en el workspace", async () => {
  const ok = await tools.write_file.run({ path: "notas/hola.txt", content: "uno\ndos" });
  assert.match(ok, /^ok, 7 bytes/);
  assert.equal(await tools.read_file.run({ path: "notas/hola.txt" }), "   1  uno\n   2  dos");
  await assert.rejects(tools.write_file.run({ path: "../escape.txt", content: "x" }), /Ruta fuera de/);
});

test("write_memory: solo dentro de areas/, ni siquiera con ../ (y las pruebas escriben en una memoria temporal)", async () => {
  assert.match(await tools.write_memory.run({ path: "profile.md", content: "x" }), /solo se escribe dentro de areas/);
  await assert.rejects(tools.write_memory.run({ path: "areas/../profile.md", content: "x" }), /Ruta fuera de/);
  assert.match(await tools.write_memory.run({ path: "areas/prueba.md", content: "- [stated] prueba" }), /^ok/);
  assert.equal(await fs.readFile(path.join(mem.dir, "areas", "prueba.md"), "utf8"), "- [stated] prueba");
  assert.equal(mem.dir.includes("ada-memoria-"), true, "ADA_MEMORY apunta a la carpeta temporal, no al repo");
});

test("read_memory y el índice de memoria siguen a ADA_MEMORY", async () => {
  await tools.write_memory.run({ path: "areas/tema.md", content: "---\nname: tema\ndescription: una prueba\n---\n- [stated] x" });
  assert.match(await tools.read_memory.run({ path: "areas/tema.md" }), /\[stated\] x/);
  const { memoryIndex } = await import("../../dist/src/context.js");
  assert.match(await memoryIndex(), /- areas\/tema\.md: una prueba/);
});

test("write_memory: tampoco escribe .env ni .git dentro de areas/", async () => {
  await assert.rejects(tools.write_memory.run({ path: "areas/.env", content: "x" }), /Archivo protegido/);
  await assert.rejects(tools.write_memory.run({ path: "areas/sub/.git/config", content: "x" }), /Archivo protegido/);
});

test("read_memory y load_skill no leen nombres protegidos ni salen por un enlace", async () => {
  await assert.rejects(tools.read_memory.run({ path: ".env" }), /Archivo protegido/);
  await assert.rejects(tools.load_skill.run({ name: ".env" }), /Archivo protegido/);
  const afuera = ws.dir + "-hermano";
  await fs.mkdir(afuera, { recursive: true });
  await fs.symlink(afuera, path.join(mem.dir, "areas", "atajo"), "dir");
  await assert.rejects(tools.write_memory.run({ path: "areas/atajo/x.md", content: "x" }), /enlace simbólico/);
});

test("web_fetch: solo http y https hacia internet; nunca esta máquina ni la red interna", async () => {
  for (const url of ["http://localhost:3000/api/providers", "http://127.0.0.1:11434/api/tags", "http://10.0.0.5/", "http://192.168.1.1/",
    "http://172.16.0.1/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://0.0.0.0/", "file:///etc/passwd", "ftp://example.com/", "no es una url"]) {
    await assert.rejects(tools.web_fetch.run({ url }), /URL no permitida/, url);
  }
});

test("web_fetch: una redirección hacia la red interna también se bloquea", async () => {
  const original = globalThis.fetch;
  /** @type {string[]} */
  const pedidas = [];
  globalThis.fetch = /** @type {any} */ (async (/** @type {any} */ url) => {
    pedidas.push(String(url));
    return { status: 302, headers: new Headers({ location: "http://127.0.0.1:3000/api/providers" }), text: async () => "" };
  });
  try {
    await assert.rejects(tools.web_fetch.run({ url: "http://93.184.216.34/" }), /URL no permitida/);
    assert.deepEqual(pedidas, ["http://93.184.216.34/"], "nunca pidió la dirección interna");
  } finally { globalThis.fetch = original; }
});

test("run_command: corre en el workspace y sin shell", async () => {
  const cwd = await tools.run_command.run({ program: process.execPath, args: ["-e", "console.log(process.cwd())"] });
  assert.equal(await fs.realpath(cwd.trim()), await fs.realpath(ws.dir));
  // with no shell, "&&" chains nothing: a program with that name does not exist
  assert.match(await tools.run_command.run({ program: "echo hola && echo chao" }), /^error/);
});

test("run_command: no lee ni escribe fuera del workspace", async () => {
  const secreto = path.join(path.dirname(ws.dir), "ada-secreto.txt");
  await fs.writeFile(secreto, "SECRETO-FUERA");
  const dentro = path.join(ws.dir, "nota.txt");
  await fs.writeFile(dentro, "dentro");
  const leer = (archivo) => `try{process.stdout.write(require("fs").readFileSync(${JSON.stringify(archivo)},"utf8"))}catch(e){process.stdout.write("DENIED")}`;
  try {
    const fuera = await tools.run_command.run({ program: process.execPath, args: ["-e", leer(secreto)] });
    const delRepo = await tools.run_command.run({ program: process.execPath, args: ["-e", leer(path.join(paths.root, "package.json"))] });
    const adentro = await tools.run_command.run({ program: process.execPath, args: ["-e", leer(dentro)] });
    const escrito = await tools.run_command.run({
      program: process.execPath,
      args: ["-e", `try{require("fs").writeFileSync(${JSON.stringify(secreto)},"pwn");process.stdout.write("WROTE")}catch(e){process.stdout.write("DENIED")}`],
    });
    assert.equal(adentro.trim(), "dentro");
    // Seatbelt ships with macOS. Linux still runs in the directory; this assertion waits for bubblewrap.
    if (process.platform === "darwin") {
      assert.equal(fuera.includes("SECRETO-FUERA"), false, fuera);
      assert.match(fuera, /DENIED/);
      assert.match(delRepo, /DENIED/);
      assert.equal(delRepo.includes("ada-harness"), false, delRepo);
      assert.match(escrito, /DENIED/);
      assert.equal(await fs.readFile(secreto, "utf8"), "SECRETO-FUERA");
    }
  } finally {
    await fs.rm(secreto, { force: true });
  }
});

test("load_skill: carga por nombre y no sale de harness/skills", async () => {
  assert.match(await tools.load_skill.run({ name: "spec-first" }), /^---\nname: spec-first/);
  await assert.rejects(tools.load_skill.run({ name: "../memory" }), /Ruta fuera de|ENOENT/);
});

test("definitions: todas las herramientas, o el subconjunto de un subagente", () => {
  assert.deepEqual(definitions().map((d) => d.name),
    ["list_dir", "read_file", "write_file", "run_command", "web_fetch", "load_skill", "read_memory", "write_memory"]);
  assert.deepEqual(definitions(["read_file", "list_dir"]).map((d) => d.name), ["list_dir", "read_file"]);
});
