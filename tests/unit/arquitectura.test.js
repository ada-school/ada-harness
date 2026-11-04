// Architecture tests: every decision in docs/decisiones/ that can be checked, is checked.
// If one of these fails, do not change it so it passes: read the decision it cites.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { paths } from "../../dist/src/config.js";

const dirApp = path.join(paths.app, "js");
const modulos = readdirSync(dirApp).filter((f) => f.endsWith(".js"));
/** @param {string} f */
const leer = (f) => readFileSync(path.join(dirApp, f), "utf8");
/** Comments out: a rule cited in a comment is not a violation. */
const sinComentarios = (/** @type {string} */ codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// Modules with no logic of their own (decision 0003): startup, API, and pure render. Every other module decides something
// and has its own test file.
const SIN_LOGICA = ["main.js", "api.js", "chat.js"];

test("ADR 0001: el chat importa solo rutas relativas, nunca un paquete de npm", () => {
  for (const f of modulos) {
    const codigo = sinComentarios(leer(f));
    const rutas = [...codigo.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1] || m[2]);
    for (const r of rutas) assert.match(r, /^\.{0,2}\//, `${f} importa "${r}"`);
  }
});

test("ADR 0001: el chat no importa paquetes; la única dependencia de ejecución es ajv", () => {
  const pkg = JSON.parse(readFileSync(path.join(paths.root, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(pkg.dependencies || {}), ["ajv"], "solo ajv: ver docs/decisiones/0009");
});

test("ADR 0010: ada es el bin, y los scripts de chat y terminal lo llaman", () => {
  const pkg = JSON.parse(readFileSync(path.join(paths.root, "package.json"), "utf8"));
  assert.equal(pkg.bin?.ada, "bin/ada.js");
  for (const script of ["start", "cli", "capas"]) assert.match(pkg.scripts[script], /bin\/ada\.js/);
  const bin = readFileSync(path.join(paths.root, "bin", "ada.js"), "utf8");
  assert.match(bin, /^#!\/usr\/bin\/env node/);
});

test("ADR 0003: cada módulo con lógica del chat tiene su archivo de pruebas", () => {
  for (const f of modulos.filter((m) => !SIN_LOGICA.includes(m))) {
    const prueba = path.join(paths.root, "tests", "unit", "app", f.replace(/\.js$/, ".test.js"));
    assert.ok(existsSync(prueba), `falta tests/unit/app/${path.basename(prueba)} para app/js/${f}`);
  }
});

test("ADR 0003: ningún módulo del chat interpreta texto como HTML", () => {
  for (const f of modulos) {
    assert.doesNotMatch(sinComentarios(leer(f)), /\.(inner|outer)HTML\b|insertAdjacentHTML|document\.write/, f);
  }
});

test("ADR 0003: el HTML es solo estructura, sin scripts ni estilos en línea", () => {
  const html = readFileSync(path.join(paths.app, "index.html"), "utf8");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "un <script> sin src");
  assert.doesNotMatch(html, /<style\b|\sstyle=|\son[a-z]+=/i, "estilos o manejadores en línea");
});

/** Strips comments, quoted text, and arrows, so the search looks for comparisons in the code. */
const soloCodigo = (/** @type {string} */ codigo) => sinComentarios(codigo)
  .replace(/`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/g, '""').replace(/=>/g, "");

test("ADR 0003: main.js y los render*() no comparan datos; solo siguen lo que calculó una vista", () => {
  const COMPARA = /===|!==|==|!=|<=|>=|\s<\s|\s>\s/;
  assert.doesNotMatch(soloCodigo(leer("main.js")), COMPARA, "main.js");
  for (const f of modulos) {
    for (const m of leer(f).matchAll(/export function (render\w*)\([^)]*\)\s*\{([\s\S]*?)\n\}/g)) {
      assert.doesNotMatch(soloCodigo(m[2]), COMPARA, `${f} › ${m[1]}`);
    }
  }
});

test("ADR 0004: cada export de src/, harness/tools/ y app/js/ tiene su bloque JSDoc", () => {
  const fuentes = [
    ...modulos.map((f) => path.join(dirApp, f)),
    path.join(paths.root, "harness", "tools", "index.ts"),
    ...buscarExt(path.join(paths.root, "src"), ".ts"),
  ];
  for (const archivo of fuentes) {
    const codigo = readFileSync(archivo, "utf8");
    for (const m of codigo.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)) {
      const antes = codigo.slice(0, m.index).trimEnd();
      assert.ok(antes.endsWith("*/"), `${path.relative(paths.root, archivo)} › ${m[1]} no tiene JSDoc`);
    }
  }
});

/** @param {string} d @param {string} ext @returns {string[]} */
function buscarExt(d, ext) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? buscarExt(path.join(d, e.name), ext) : e.name.endsWith(ext) ? [path.join(d, e.name)] : []);
}
