// CU-02 Elegir con qué modelo habla. Lógica pura de app/js/selector.js.
// Los datos tienen la forma real de GET /api/providers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOptions, pickSelection, parseSelection, SIN_MODELOS } from "../../../app/js/selector.js";

const proveedores = [
  { name: "anthropic", label: "Claude", model: "claude-sonnet-5-5", configured: true, keyEnv: "ANTHROPIC_API_KEY", default: false },
  { name: "gemini", label: "Gemini", model: "gemini-3.8-flash", configured: false, keyEnv: "GEMINI_API_KEY", default: false },
  { name: "ollama", label: "Ollama", model: "qwen3:8b", configured: true, keyEnv: null, default: true, status: {
    host: "http://localhost:11434", detected: true, models: [
      { name: "qwen3:8b", tools: true, remote: false, params: "8.2B" },
      { name: "llava:7b", tools: false, remote: false, params: "7B" },
      { name: "gpt-oss:120b-cloud", tools: true, remote: true, params: "116.8B" },
    ] } },
];
const sinOllama = (/** @type {any} */ p) => ({ ...p, status: { host: "http://localhost:11434", detected: false, models: [] } });

test("CU-02.1 Claude y Gemini: con clave se eligen y muestran su modelo; sin clave, dicen qué variable falta", () => {
  const [base] = buildOptions(proveedores);
  assert.deepEqual(base.options, [
    { value: "anthropic|", label: "Claude · claude-sonnet-5-5", disabled: false },
    { value: "gemini|", label: "Gemini · gemini-3.8-flash (falta GEMINI_API_KEY)", disabled: true },
  ]);
});

test("CU-02.2 Ollama: un grupo con su host, cada modelo marcado local, nube o sin herramientas", () => {
  const ollama = buildOptions(proveedores)[1];
  assert.equal(ollama.label, "Ollama · http://localhost:11434");
  assert.deepEqual(ollama.options.map((o) => [o.label, o.disabled]), [
    ["qwen3:8b · 8.2B (local, gratis)", false],
    ["llava:7b · 7B (no usa herramientas)", true],
    ["gpt-oss:120b-cloud · 116.8B (nube, requiere cuenta)", false],
  ]);
});

test("CU-02.3 sin Ollama, una opción deshabilitada dice cómo instalarlo y arrancarlo", () => {
  const grupos = buildOptions([sinOllama(proveedores[2])]);
  assert.deepEqual(grupos[1].options, [{ label: 'No detectado: instala Ollama y corre "ollama serve"', disabled: true }]);
});

test("CU-02.4 se mantiene la actual, luego la guardada, luego la del servidor; nunca una deshabilitada", () => {
  const grupos = buildOptions(proveedores);
  assert.equal(pickSelection({ grupos, providers: proveedores, current: "anthropic|", saved: "ollama|qwen3:8b" }), "anthropic|");
  assert.equal(pickSelection({ grupos, providers: proveedores, current: null, saved: "gemini|" }), "ollama|qwen3:8b", "gemini no tiene clave");
  assert.equal(pickSelection({ grupos, providers: proveedores, saved: "ollama|gpt-oss:120b-cloud" }), "ollama|gpt-oss:120b-cloud");
  assert.equal(pickSelection({ grupos, providers: proveedores, saved: "ollama|llava:7b" }), "ollama|qwen3:8b", "llava no usa herramientas");
});

test("CU-02.5 el valor se separa en proveedor y modelo, aunque el modelo tenga ':'", () => {
  assert.deepEqual(parseSelection("ollama|qwen3:8b"), { provider: "ollama", model: "qwen3:8b" });
  assert.deepEqual(parseSelection("gemini|"), { provider: "gemini", model: undefined });
  assert.deepEqual(parseSelection("anthropic"), { provider: "anthropic", model: undefined });
});

test("CU-02.7 sin ningún modelo disponible no se elige nada, y el aviso dice cómo conseguir uno", () => {
  const nada = [{ ...proveedores[0], configured: false }, proveedores[1], sinOllama(proveedores[2])];
  assert.equal(pickSelection({ grupos: buildOptions(nada), providers: nada }), null);
  assert.match(SIN_MODELOS, /\.env/);
  assert.match(SIN_MODELOS, /ollama pull qwen3:8b/);
});
