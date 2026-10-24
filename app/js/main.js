// Arranque del chat: conecta la API, el selector, la conversación y el inspector.

import { getProviders, sendMessage, resetSessions } from "./api.js";
import { buildOptions, pickSelection, parseSelection, renderSelector } from "./selector.js";
import { inspectorView, renderInspector } from "./inspector.js";
import { createLog } from "./chat.js";

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const select = /** @type {HTMLSelectElement} */ ($("prov"));
const input = /** @type {HTMLTextAreaElement} */ ($("t"));
const send = /** @type {HTMLButtonElement} */ ($("send"));
const form = /** @type {HTMLFormElement} */ ($("f"));
const chat = createLog($("log"));
const session = "s" + Math.random().toString(36).slice(2);
const CLAVE = "ada-proveedor";

let providers = [];
let presupuesto = 120000;

const guardado = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardar = (v) => { try { localStorage.setItem(CLAVE, v); } catch { /* sin almacenamiento */ } };

async function cargarProveedores() {
  try {
    providers = await getProviders();
    const grupos = buildOptions(providers);
    const actual = select.value;
    renderSelector(select, grupos);
    const elegido = pickSelection({ grupos, providers, current: actual, saved: guardado() });
    if (elegido) select.value = elegido;
    else chat.add("s", "Ningún modelo disponible. Agrega una clave en .env, o instala Ollama y descarga un modelo: ollama pull qwen3:8b");
  } catch {
    select.replaceChildren(new Option("sin servidor"));
  }
}

select.addEventListener("focus", cargarProveedores);   // por si arrancaste Ollama con la página abierta
select.addEventListener("change", () => {
  guardar(select.value);
  const { provider, model } = parseSelection(select.value);
  const p = providers.find((x) => x.name === provider);
  chat.clear();
  chat.add("s", `Ahora hablas con ${p.label} (${model || p.model}). Conversación nueva: el loop, las capas y las herramientas son los mismos; solo cambia el adaptador de src/providers/.`);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  chat.add("u", message);
  input.value = "";
  send.disabled = true;
  const espera = chat.add("s", "pensando…");
  try {
    const d = await sendMessage({ session, message, ...parseSelection(select.value) });
    espera.remove();
    if (d.error) chat.add("s", "error: " + d.error);
    else {
      if (d.reset) chat.add("s", "Cambiaste de proveedor: empezó una conversación nueva.");
      chat.add("a", d.text || "");
      const vista = inspectorView(d.trace, presupuesto);
      presupuesto = vista.budget;
      renderInspector(vista, $);
    }
  } catch (err) {
    espera.textContent = "error: " + err.message;
  }
  send.disabled = false;
  input.focus();
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(160, input.scrollHeight) + "px";
});
$("reset").addEventListener("click", async () => { await resetSessions(); location.reload(); });

cargarProveedores();
