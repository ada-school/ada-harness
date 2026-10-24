// El chat: la lógica de qué se muestra corre en Node, sin navegador. Las funciones que tocan
// el DOM (render*) son delgadas y usan textContent; una prueba vigila que nadie use innerHTML.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildOptions, pickSelection, parseSelection } from "../../app/js/selector.js";
import { inspectorView } from "../../app/js/inspector.js";
import { colorDeCapa, num } from "../../app/js/format.js";
import { paths } from "../../src/config.js";

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

test("selector: Claude y Gemini con su estado, Ollama agrupado por modelo", () => {
  const [base, ollama] = buildOptions(proveedores);
  assert.deepEqual(base.options, [
    { value: "anthropic|", label: "Claude · claude-sonnet-5-5", disabled: false },
    { value: "gemini|", label: "Gemini · gemini-3.8-flash (falta GEMINI_API_KEY)", disabled: true },
  ]);
  assert.equal(ollama.label, "Ollama · http://localhost:11434");
  assert.deepEqual(ollama.options.map((o) => [o.label, o.disabled]), [
    ["qwen3:8b · 8.2B (local, gratis)", false],
    ["llava:7b · 7B (no usa herramientas)", true],
    ["gpt-oss:120b-cloud · 116.8B (nube, requiere cuenta)", false],
  ]);
});

test("selector: sin Ollama, una opción deshabilitada que dice qué hacer", () => {
  const grupos = buildOptions([{ ...proveedores[2], status: { host: "http://localhost:11434", detected: false, models: [] } }]);
  assert.deepEqual(grupos[1].options, [{ label: 'No detectado: instala Ollama y corre "ollama serve"', disabled: true }]);
});

test("selector: elige la actual, luego la guardada, luego la del servidor; nunca una deshabilitada", () => {
  const grupos = buildOptions(proveedores);
  assert.equal(pickSelection({ grupos, providers: proveedores, current: "anthropic|", saved: "ollama|qwen3:8b" }), "anthropic|");
  assert.equal(pickSelection({ grupos, providers: proveedores, current: null, saved: "gemini|" }), "ollama|qwen3:8b", "gemini no tiene clave");
  assert.equal(pickSelection({ grupos, providers: proveedores, saved: "ollama|gpt-oss:120b-cloud" }), "ollama|gpt-oss:120b-cloud");
});

test("selector: el valor se separa en proveedor y modelo, aunque el modelo tenga ':'", () => {
  assert.deepEqual(parseSelection("ollama|qwen3:8b"), { provider: "ollama", model: "qwen3:8b" });
  assert.deepEqual(parseSelection("gemini|"), { provider: "gemini", model: undefined });
  assert.deepEqual(parseSelection("anthropic"), { provider: "anthropic", model: undefined });
});

const trace = {
  provider: "ollama", model: "qwen3:8b", budget: 16384, calls: 2,
  tools: [{ name: "write_file", input: { path: "a", content: "<img src=x onerror=alert(1)>" }, tokens: 9, agent: null }],
  events: [{ type: "subagent", agent: "reviewer", calls: 2, tools: 1 }, { type: "warning", text: "ventana chica" }],
  lastContext: { layers: [{ name: "system", tokens: 1638 }, { name: "toolDefinitions", tokens: 1638 }], usage: { input_tokens: 2100 } },
};

test("inspector: la ventana real del modelo es el 100% del medidor", () => {
  const v = inspectorView(trace);
  assert.equal(v.modelo, `proveedor: ollama · qwen3:8b · ventana ${num(16384)}`);
  assert.deepEqual(v.segmentos.map((s) => s.width), ["10.00%", "10.00%"]);
  assert.equal(v.usado, `~${num(3276)} / ${num(16384)} tokens estimados (20.0%)`);
  assert.deepEqual(v.contadores, { calls: "2", tools: "1", intok: num(2100) });
});

test("inspector: sin ventana en el trace, usa la última conocida", () => {
  const v = inspectorView({ ...trace, budget: undefined }, 120000);
  assert.equal(v.budget, 120000);
  assert.equal(v.modelo, "proveedor: ollama · qwen3:8b");
});

test("inspector: los eventos son texto plano, también cuando el modelo mete HTML", () => {
  const v = inspectorView(trace);
  assert.deepEqual(v.eventos.map((e) => e.cls), ["tool", "sub", "cmp"]);
  assert.match(v.eventos[0].text, /<img src=x onerror=alert\(1\)>/, "se muestra literal; renderInspector lo pone con textContent");
  assert.equal(v.eventos[2].text, "aviso: ventana chica");
});

test("colores: una capa tiene el mismo color en el explicador y en el inspector", () => {
  assert.equal(colorDeCapa("system (agente: reviewer)"), "--l-sys");
  assert.equal(colorDeCapa("toolResults"), "--l-res");
  assert.equal(colorDeCapa("desconocida"), "--fg2");
});

test("ningún módulo del chat usa innerHTML ni outerHTML: texto del modelo nunca se interpreta como HTML", () => {
  const dir = path.join(paths.app, "js");
  for (const f of readdirSync(dir)) {
    const codigo = readFileSync(path.join(dir, f), "utf8").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(codigo, /\.(inner|outer)HTML\b|insertAdjacentHTML/, f);
  }
});
