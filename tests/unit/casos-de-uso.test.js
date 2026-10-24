// Trazabilidad (decisión 0007): cada criterio de aceptación tiene una prueba que lo nombra.
// La matriz completa: npm run trazabilidad

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { trazabilidad } from "../trazabilidad.js";
import { paths } from "../../src/config.js";

const t = trazabilidad();

test("trazabilidad: hay casos de uso con criterios", () => {
  assert.ok(t.filas.length > 0, "docs/casos-de-uso/ no tiene criterios con el formato - **CU-NN.M**");
});

test("trazabilidad: cada criterio automático tiene al menos una prueba que lo nombra", () => {
  assert.deepEqual(t.sinPrueba, [], `criterios sin prueba: ${t.sinPrueba.join(", ")}. Escribe la prueba primero (harness/skills/frontend-tdd).`);
});

test("trazabilidad: ninguna prueba nombra un criterio que no existe", () => {
  assert.deepEqual(t.inexistentes, [], "si borraste un criterio, borra o renombra sus pruebas");
});

test("trazabilidad: cada ID de criterio es único y pertenece a su caso", () => {
  assert.deepEqual(t.repetidos, []);
  for (const f of t.filas) assert.ok(f.caso.startsWith(f.id.slice(0, 5)), `${f.id} está en ${f.caso}`);
});

test("casos de uso: cada uno tiene actor, objetivo, flujo principal y criterios", () => {
  const dir = path.join(paths.docs, "casos-de-uso");
  for (const f of readdirSync(dir).filter((x) => /^CU-\d{2}.*\.md$/.test(x))) {
    const texto = readFileSync(path.join(dir, f), "utf8");
    for (const seccion of ["**Actor:**", "**Objetivo:**", "## Flujo principal", "## Criterios de aceptación"]) {
      assert.ok(texto.includes(seccion), `${f}: falta ${seccion}`);
    }
  }
});

test("casos de uso: un criterio manual dice cómo verificarlo", () => {
  for (const f of t.filas.filter((x) => x.manual)) assert.match(f.texto, /Verificación:/, f.id);
});
