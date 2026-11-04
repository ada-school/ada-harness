// CU-01 Talk to the agent (and the CU-02.6 notice). Pure logic from app/js/conversacion.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { debeEnviar, textoAEnviar, lineasDeRespuesta, textoDeError, avisoDeCambio, altoDelCampo, tomarEventos, aplicarEvento, idDeSesion } from "../../../app/js/conversacion.js";

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
  assert.deepEqual(lineasDeRespuesta({ error: "Missing ANTHROPIC_API_KEY in .env" }), [{ tipo: "s", texto: "error: Missing ANTHROPIC_API_KEY in .env" }]);
  assert.equal(textoDeError("Failed to fetch"), "error: Failed to fetch");
});

test("CU-01.8 la respuesta se muestra a medida que llegan los trozos y al cerrar conserva el texto y la traza", () => {
  const vacío = { texto: "", listo: false, trace: null, error: null, reset: false };
  const cortado = tomarEventos('event: delta\ndata: {"text":"ho"}\n\nevent: delta\ndata: {"text":"<b>"}\n\nrest');
  assert.equal(cortado.rest, "rest");
  let visto = aplicarEvento(vacío, cortado.events[0]);
  assert.equal(visto.texto, "ho");
  assert.equal(visto.listo, false);
  visto = aplicarEvento(visto, cortado.events[1]);
  assert.equal(visto.texto, "ho<b>", "el HTML llega como texto");
  const cierre = tomarEventos('event: done\ndata: {"text":"otro","trace":{"calls":1},"reset":true}\n\n');
  visto = aplicarEvento(visto, cierre.events[0]);
  assert.equal(visto.listo, true);
  assert.equal(visto.texto, "ho<b>", "el cierre no borra lo ya mostrado");
  assert.equal(visto.trace.calls, 1);
  assert.equal(visto.reset, true);
  const directo = aplicarEvento(vacío, { event: "done", data: { text: "listo", trace: { calls: 2 } } });
  assert.equal(directo.texto, "listo");
  const fallo = aplicarEvento(vacío, { event: "error", data: { error: "missing" } });
  assert.equal(fallo.listo, true);
  assert.equal(fallo.error, "missing");
});

test("CU-01.9 el mismo navegador conserva el id de la sesión", () => {
  assert.equal(idDeSesion("s1", "s2"), "s1");
  assert.equal(idDeSesion("", "s2"), "s2");
  assert.equal(idDeSesion(null, "s2"), "s2");
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
    "You are now talking to Claude (claude-sonnet-5-5). New conversation: the loop, the layers, and the tools are the same; only the adapter in src/providers/ changes.");
  assert.match(avisoDeCambio(proveedores, "ollama|llama3.1:8b"), /^You are now talking to Ollama \(llama3\.1:8b\)\./);
  assert.equal(avisoDeCambio(proveedores, "gemini|"), "New conversation.", "un valor que ya no está en la lista no rompe el chat");
});

test("CU-02.6 si el servidor reinició la conversación por cambio de proveedor, el chat lo dice antes de la respuesta", () => {
  const lineas = lineasDeRespuesta({ text: "hola", reset: true });
  assert.deepEqual(lineas.map((l) => l.tipo), ["s", "a"]);
  assert.equal(lineas[0].texto, "You switched providers: a new conversation started.");
});
