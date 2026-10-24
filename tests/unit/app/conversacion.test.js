// CU-01 Conversar con el agente (y el aviso de CU-02.6). Lógica pura de app/js/conversacion.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { debeEnviar, textoAEnviar, lineasDeRespuesta, textoDeError, avisoDeCambio, altoDelCampo } from "../../../app/js/conversacion.js";

test("CU-01.1 Enter envía; Shift+Enter y Enter mientras se compone texto (IME) no", () => {
  assert.equal(debeEnviar({ key: "Enter" }), true);
  assert.equal(debeEnviar({ key: "Enter", shiftKey: true }), false);
  assert.equal(debeEnviar({ key: "Enter", isComposing: true }), false);
  assert.equal(debeEnviar({ key: "a" }), false);
});

test("CU-01.2 vacío o solo espacios no se envía; con texto, se envía sin los espacios de los extremos", () => {
  assert.equal(textoAEnviar(""), null);
  assert.equal(textoAEnviar("  \n\t "), null);
  assert.equal(textoAEnviar("  hola \n"), "hola");
  assert.equal(textoAEnviar("uno\ndos"), "uno\ndos", "los saltos de línea internos se mantienen");
});

test("CU-01.3 la respuesta del modelo llega a la conversación tal cual, también si trae HTML", () => {
  const html = '<img src=x onerror="alert(1)">';
  assert.deepEqual(lineasDeRespuesta({ text: html }), [{ tipo: "a", texto: html }]);
});

test("CU-01.4 un error del servidor o de la red se muestra con su motivo", () => {
  assert.deepEqual(lineasDeRespuesta({ error: "Falta ANTHROPIC_API_KEY en .env" }), [{ tipo: "s", texto: "error: Falta ANTHROPIC_API_KEY en .env" }]);
  assert.equal(textoDeError("Failed to fetch"), "error: Failed to fetch");
});

test("CU-01.6 el campo crece con el texto hasta 160 px", () => {
  assert.equal(altoDelCampo(38), "38px");
  assert.equal(altoDelCampo(160), "160px");
  assert.equal(altoDelCampo(900), "160px");
});

test("CU-02.6 al cambiar de modelo, el chat avisa con quién habla y que empieza una conversación nueva", () => {
  const proveedores = [
    { name: "anthropic", label: "Claude", model: "claude-sonnet-5-5" },
    { name: "ollama", label: "Ollama", model: "qwen3:8b" },
  ];
  assert.equal(avisoDeCambio(proveedores, "anthropic|"),
    "Ahora hablas con Claude (claude-sonnet-5-5). Conversación nueva: el loop, las capas y las herramientas son los mismos; solo cambia el adaptador de src/providers/.");
  assert.match(avisoDeCambio(proveedores, "ollama|llama3.1:8b"), /^Ahora hablas con Ollama \(llama3\.1:8b\)\./);
  assert.equal(avisoDeCambio(proveedores, "gemini|"), "Conversación nueva.", "un valor que ya no está en la lista no rompe el chat");
});

test("CU-02.6 si el servidor reinició la conversación por cambio de proveedor, el chat lo dice antes de la respuesta", () => {
  const lineas = lineasDeRespuesta({ text: "hola", reset: true });
  assert.deepEqual(lineas.map((l) => l.tipo), ["s", "a"]);
  assert.equal(lineas[0].texto, "Cambiaste de proveedor: empezó una conversación nueva.");
});
