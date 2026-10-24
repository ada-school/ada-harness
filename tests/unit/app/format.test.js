// Utilidades de presentación de app/js/format.js, al servicio de CU-03.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { colorDeCapa, num } from "../../../app/js/format.js";
import { paths } from "../../../src/config.js";

test("CU-03.4 cada capa usa el color del explicador; una desconocida, gris neutro", () => {
  assert.equal(colorDeCapa("system"), "--l-sys");
  assert.equal(colorDeCapa("system (agente: reviewer)"), "--l-sys", "el system de un subagente es la misma capa");
  assert.equal(colorDeCapa("toolResults"), "--l-res");
  assert.equal(colorDeCapa("desconocida"), "--fg2");
});

test("CU-03.4 cada capa tiene en el chat el mismo color que en el explicador", () => {
  /** Primer valor de una variable CSS en un archivo: el del tema claro. */
  const valor = (/** @type {string} */ texto, /** @type {string} */ variable) => texto.match(new RegExp(`${variable}\\s*:\\s*(#[0-9a-f]{3,8})`, "i"))?.[1];
  const css = readFileSync(path.join(paths.app, "styles.css"), "utf8");
  const explicador = readFileSync(path.join(paths.docs, "Anatomía de un Agente.html"), "utf8");
  const capas = ["system", "projectGuide", "skillsIndex", "memoryCore", "memoryIndex", "toolDefinitions", "history (user)", "history (assistant)", "toolResults"];
  for (const c of capas) {
    const v = colorDeCapa(c);
    assert.ok(valor(css, v), `${v} no está en styles.css`);
    assert.equal(valor(css, v), valor(explicador, v), `${c} (${v})`);
  }
});

test("CU-03.5 los números del inspector usan separador de miles", () => {
  assert.equal(num(16384), "16.384");
  assert.equal(num(undefined), "0");
});
