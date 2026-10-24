// Piezas chicas de la capa de entrada: qué archivos sirve el servidor y cómo lee la terminal.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveStatic } from "../../src/http/static.js";
import { createSessionStore } from "../../src/http/api.js";
import { parseArgs } from "../../src/cli.js";
import { paths } from "../../src/config.js";

test("estáticos: el chat, sus módulos y la documentación", () => {
  assert.equal(resolveStatic("/"), path.join(paths.app, "index.html"));
  assert.equal(resolveStatic("/js/main.js?v=2"), path.join(paths.app, "js", "main.js"));
  assert.equal(resolveStatic("/docs/Anatom%C3%ADa%20de%20un%20Agente.html"), path.join(paths.docs, "Anatomía de un Agente.html"));
});

test("estáticos: nada fuera de app/ y docs/, tampoco con ../ codificado", () => {
  for (const url of ["/../.env", "/docs/..%2F.env.example", "/docs/../src/harness.js", "/%2e%2e/package.json", "/%E0%A4%A"]) {
    assert.equal(resolveStatic(url), null, url);
  }
});

test("sesiones: el historial sigue con el mismo proveedor y se reinicia al cambiarlo", () => {
  const s = createSessionStore();
  assert.deepEqual(s.get("a", "ollama"), { history: [], reset: false });
  s.set("a", "ollama", [{ role: "user", content: "hola" }]);
  assert.equal(s.get("a", "ollama").history.length, 1);
  assert.deepEqual(s.get("a", "gemini"), { history: [], reset: true });
  s.clear();
  assert.equal(s.size, 0);
});

test("terminal: proveedor, modelo y mensaje", () => {
  assert.deepEqual(parseArgs(["--ollama", "--model=qwen3:8b", "lee", "AGENTS.md"]), { provider: "ollama", model: "qwen3:8b", message: "lee AGENTS.md" });
  assert.deepEqual(parseArgs(["hola"]), { provider: undefined, model: undefined, message: "hola" });
  assert.match(parseArgs([]).message, /Lista los archivos/);
});
