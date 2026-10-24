// Trazabilidad: cada criterio de docs/casos-de-uso/ contra las pruebas que lo nombran.
// Un criterio es una línea "- **CU-01.2** ..." en un CU-*.md. Una prueba lo cubre si su nombre
// incluye el ID: test("CU-01.2 un mensaje vacío no se envía", ...).
//
//   npm run trazabilidad    imprime la matriz y termina con error si falta algo
//
// tests/unit/casos-de-uso.test.js usa estas mismas funciones.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paths } from "../src/config.js";

/** @typedef {{ id: string, caso: string, manual: boolean, texto: string }} Criterio */

const ID = /CU-\d{2}\.\d+/g;

/**
 * Los criterios de aceptación de todos los casos de uso.
 * @param {string} [dir]
 * @returns {Criterio[]}
 */
export function leerCriterios(dir = path.join(paths.docs, "casos-de-uso")) {
  /** @type {Criterio[]} */
  const criterios = [];
  for (const archivo of readdirSync(dir).filter((f) => /^CU-\d{2}.*\.md$/.test(f)).sort()) {
    for (const linea of readFileSync(path.join(dir, archivo), "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*[-*]\s+\*\*(CU-\d{2}\.\d+)\*\*\s*(\(manual\))?\s*(.*)$/);
      if (m) criterios.push({ id: m[1], caso: archivo, manual: Boolean(m[2]), texto: m[3] });
    }
  }
  return criterios;
}

/**
 * Qué pruebas nombran cada criterio. Solo cuentan los nombres de test(...), no los comentarios.
 * @param {string} [dir]
 * @returns {Map<string, string[]>} ID -> ["archivo › nombre de la prueba"]
 */
export function leerReferencias(dir = path.join(paths.root, "tests")) {
  /** @type {Map<string, string[]>} */
  const refs = new Map();
  for (const archivo of archivosDePrueba(dir)) {
    const codigo = readFileSync(archivo, "utf8");
    for (const m of codigo.matchAll(/\btest\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      for (const id of m[2].match(ID) || []) {
        const lista = refs.get(id) || [];
        lista.push(`${path.relative(dir, archivo).split(path.sep).join("/")} › ${m[2]}`);
        refs.set(id, lista);
      }
    }
  }
  return refs;
}

/** @param {string} dir @returns {string[]} */
function archivosDePrueba(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? archivosDePrueba(p) : p.endsWith(".test.js") ? [p] : [];
  });
}

/** La matriz completa y lo que falta. */
export function trazabilidad() {
  const criterios = leerCriterios();
  const refs = leerReferencias();
  const ids = criterios.map((c) => c.id);
  return {
    filas: criterios.map((c) => ({ ...c, pruebas: refs.get(c.id) || [] })),
    sinPrueba: criterios.filter((c) => !c.manual && !refs.has(c.id)).map((c) => c.id),
    inexistentes: [...refs.keys()].filter((id) => !ids.includes(id)).sort(),
    repetidos: ids.filter((id, i) => ids.indexOf(id) !== i),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = trazabilidad();
  for (const f of t.filas) {
    const estado = f.pruebas.length ? f.pruebas.join("\n          ") : f.manual ? "(manual) " + f.texto.replace(/^.*Verificación:\s*/, "verificar: ") : "SIN PRUEBA";
    console.log(`${f.id.padEnd(9)} ${estado}`);
  }
  const manuales = t.filas.filter((f) => f.manual).length;
  console.log(`\nCriterios: ${t.filas.length} · automáticos con prueba: ${t.filas.length - manuales - t.sinPrueba.length} · manuales: ${manuales} · sin prueba: ${t.sinPrueba.length}`);
  if (t.inexistentes.length) console.log(`Pruebas que nombran criterios que no existen: ${t.inexistentes.join(", ")}`);
  if (t.repetidos.length) console.log(`IDs repetidos: ${t.repetidos.join(", ")}`);
  if (t.sinPrueba.length || t.inexistentes.length || t.repetidos.length) process.exitCode = 1;
}
