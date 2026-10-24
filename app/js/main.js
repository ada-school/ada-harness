// Arranque del chat: conecta la API, el selector, la conversación y el inspector.
// Aquí no se decide nada (docs/decisiones/0003): cada decisión es una función pura con su prueba.

import { getProviders, sendMessage, resetSessions } from "./api.js";
import { buildOptions, pickSelection, parseSelection, renderSelector, SIN_MODELOS } from "./selector.js";
import { inspectorView, renderInspector } from "./inspector.js";
import { debeEnviar, textoAEnviar, lineasDeRespuesta, textoDeError, avisoDeCambio, altoDelCampo } from "./conversacion.js";
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

// CU-02: llenar el selector y mantener la elección.
async function cargarProveedores() {
  try {
    providers = await getProviders();
    const grupos = buildOptions(providers);
    const actual = select.value;
    renderSelector(select, grupos);
    const elegido = pickSelection({ grupos, providers, current: actual, saved: guardado() });
    if (elegido) select.value = elegido;
    else chat.add("s", SIN_MODELOS);
  } catch {
    select.replaceChildren(new Option("sin servidor"));
  }
}

select.addEventListener("focus", cargarProveedores);   // por si arrancaste Ollama con la página abierta
select.addEventListener("change", () => {
  guardar(select.value);
  chat.clear();
  chat.add("s", avisoDeCambio(providers, select.value));
});

// CU-01: un turno.
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = textoAEnviar(input.value);
  if (!message) return;
  chat.add("u", message);
  input.value = "";
  send.disabled = true;
  const espera = chat.add("s", "pensando…");
  try {
    const d = await sendMessage({ session, message, ...parseSelection(select.value) });
    espera.remove();
    for (const l of lineasDeRespuesta(d)) chat.add(l.tipo, l.texto);
    const vista = inspectorView(d.trace, presupuesto);
    if (vista) {
      presupuesto = vista.budget;
      renderInspector(vista, $);
    }
  } catch (err) {
    espera.textContent = textoDeError(err.message);
  }
  send.disabled = false;
  input.focus();
});

input.addEventListener("keydown", (e) => {
  if (debeEnviar(e)) { e.preventDefault(); form.requestSubmit(); }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = altoDelCampo(input.scrollHeight);
});

// CU-04: conversación nueva.
$("reset").addEventListener("click", async () => { await resetSessions(); location.reload(); });

cargarProveedores();
