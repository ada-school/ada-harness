// Contexto: cómo se arma la ventana a partir de las capas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { frontmatter, estimateTokens, historyReport, assembleSystem, skillsIndex, loadRouting } from "../../src/context.js";

test("frontmatter: lee claves, también con saltos de línea de Windows y BOM", () => {
  const esperado = { name: "x", description: "Cárgalo cuando pidan y" };
  assert.deepEqual(frontmatter("---\nname: x\ndescription: Cárgalo cuando pidan y\n---\ncuerpo"), esperado);
  assert.deepEqual(frontmatter("﻿---\r\nname: x\r\ndescription: Cárgalo cuando pidan y\r\n---\r\ncuerpo"), esperado);
  assert.deepEqual(frontmatter("sin frontmatter"), {});
});

test("estimateTokens: unos 4 caracteres por token", () => {
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
  assert.equal(estimateTokens({ a: 1 }), Math.ceil(JSON.stringify({ a: 1 }).length / 4));
});

test("historyReport: separa usuario, asistente y resultados de herramientas", () => {
  const r = historyReport([
    { role: "user", content: "abcdefgh" },
    { role: "assistant", content: [{ type: "text", text: "abcd" }, { type: "tool_use", id: "1", name: "x", input: { a: 1 } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "1", content: "a".repeat(40) }] },
  ]);
  assert.deepEqual(r.map((l) => [l.name, l.tokens]), [["history (user)", 2], ["history (assistant)", 1 + estimateTokens({ a: 1 })], ["toolResults", 10]]);
});

test("índice de skills: nombre y descripción, nunca el cuerpo", async () => {
  const idx = await skillsIndex("harness/skills");
  assert.match(idx, /- spec-first: Procedimiento para empezar/);
  assert.match(idx, /- commit-convention: /);
  assert.doesNotMatch(idx, /# Spec first/, "el cuerpo del skill no entra al índice");
});

test("assembleSystem: las capas del agente principal, en orden y con su etiqueta", async () => {
  const routing = await loadRouting();
  const { system, layers } = await assembleSystem({ routing });
  assert.deepEqual(layers.map((l) => l.name), ["system", "projectGuide", "skillsIndex", "memoryCore", "memoryIndex"]);
  assert.ok(layers.every((l) => l.tokens > 0));
  assert.ok(system.indexOf("<system>") < system.indexOf("<projectGuide>"));
  assert.match(system, /<skillsIndex>\nSkills disponibles/);
});

test("assembleSystem: un subagente solo recibe su prompt y la guía del proyecto", async () => {
  const routing = await loadRouting();
  const { system, layers } = await assembleSystem({ routing, agentName: "reviewer" });
  assert.deepEqual(layers.map((l) => l.name), ["system (agente: reviewer)", "projectGuide"]);
  assert.match(system, /subagente revisor/);
  assert.doesNotMatch(system, /skillsIndex|memoryCore/);
});
