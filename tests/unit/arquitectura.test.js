// Pruebas de arquitectura: cada decisión de docs/decisiones/ que se puede verificar, se verifica.
// Si una de estas falla, no la ajustes para que pase: lee la decisión que cita.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { paths } from "../../src/config.js";

const dirApp = path.join(paths.app, "js");
const modulos = readdirSync(dirApp).filter((f) => f.endsWith(".js"));
/** @param {string} f */
const leer = (f) => readFileSync(path.join(dirApp, f), "utf8");
/** Comentarios fuera: una regla citada en un comentario no es una violación. */
const sinComentarios = (/** @type {string} */ codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// Módulos sin lógica propia (decisión 0003): arranque, API y render puro. Todo otro módulo decide algo
// y tiene su archivo de pruebas.
const SIN_LOGICA = ["main.js", "api.js", "chat.js"];

test("ADR 0001: el chat importa solo rutas relativas, nunca un paquete de npm", () => {
  for (const f of modulos) {
    const codigo = sinComentarios(leer(f));
    const rutas = [...codigo.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1] || m[2]);
    for (const r of rutas) assert.match(r, /^\.{0,2}\//, `${f} importa "${r}"`);
  }
});

test("ADR 0001: el harness no declara dependencias para correr", () => {
  const pkg = JSON.parse(readFileSync(path.join(paths.root, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(pkg.dependencies || {}), [], "solo devDependencies: ver docs/decisiones/0001");
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

/** Quita comentarios, textos entre comillas y flechas, para buscar comparaciones en el código. */
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
    path.join(paths.root, "harness", "tools", "index.js"),
    ...buscarJs(path.join(paths.root, "src")),
  ];
  for (const archivo of fuentes) {
    const codigo = readFileSync(archivo, "utf8");
    for (const m of codigo.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)) {
      const antes = codigo.slice(0, m.index).trimEnd();
      assert.ok(antes.endsWith("*/"), `${path.relative(paths.root, archivo)} › ${m[1]} no tiene JSDoc`);
    }
  }
});

/** @param {string} d @returns {string[]} */
function buscarJs(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? buscarJs(path.join(d, e.name)) : e.name.endsWith(".js") ? [path.join(d, e.name)] : []);
}
