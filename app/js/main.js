// Arranque del chat: conecta la API, el selector, la conversación y el inspector.
// Aquí no se decide nada (docs/decisiones/0003): cada decisión es una función pura con su prueba.

import { getProviders, sendMessage, resetSessions } from "./api.js";
import { buildOptions, pickSelection, parseSelection, renderSelector, SIN_MODELOS } from "./selector.js";
import { inspectorView, renderInspector } from "./inspector.js";
import { debeEnviar, textoAEnviar, lineasDeRespuesta, textoDeError, avisoDeCambio, avisoDeReinicio, altoDelCampo, tomarEventos, aplicarEvento, idDeSesion } from "./conversacion.js";
import { createLog } from "./chat.js";

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const select = /** @type {HTMLSelectElement} */ ($("prov"));
const input = /** @type {HTMLTextAreaElement} */ ($("t"));
const send = /** @type {HTMLButtonElement} */ ($("send"));
const form = /** @type {HTMLFormElement} */ ($("f"));
const chat = createLog($("log"));
let session = "s" + Math.random().toString(36).slice(2);
try {
  session = idDeSesion(localStorage.getItem("ada-sesion"), session);
  localStorage.setItem("ada-sesion", session);
} catch { /* sin almacenamiento */ }
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
    select.replaceChildren(new Option("no server"));
  }
}

select.addEventListener("focus", cargarProveedores);   // por si arrancaste Ollama con la página abierta
select.addEventListener("change", () => {
  guardar(select.value);
  chat.clear();
  chat.add("s", avisoDeCambio(providers, select.value));
});

/** @param {Response} res @param {HTMLElement} espera */
async function leerStream(res, espera) {
  if (!res.body) throw new Error("empty reply");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  /** @type {{ texto: string, listo: boolean, trace: any, error: string | null, reset: boolean }} */
  let estado = { texto: "", listo: false, trace: null, error: null, reset: false };
  /** @type {HTMLElement | null} */
  let burbuja = null;
  let aviso = false;
  const pintar = () => {
    if (estado.reset && !aviso) {
      const node = chat.add("s", avisoDeReinicio());
      if (burbuja) burbuja.before(node);
      aviso = true;
    }
    if (!burbuja && estado.texto) {
      espera.remove();
      burbuja = chat.add("a", estado.texto);
    } else if (burbuja) burbuja.textContent = estado.texto;
    if (estado.error) {
      const linea = textoDeError(estado.error);
      if (burbuja) chat.add("s", linea);
      else espera.textContent = linea;
    }
    if (estado.listo && estado.trace) {
      const vista = inspectorView(estado.trace, presupuesto);
      if (vista) { presupuesto = vista.budget; renderInspector(vista, $); }
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const tomado = tomarEventos(buf);
    buf = tomado.rest;
    for (const evento of tomado.events) {
      estado = aplicarEvento(estado, evento);
      pintar();
    }
  }
  if (espera.isConnected && !estado.error) espera.textContent = textoDeError("the reply ended early");
}

// CU-01: un turno.
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = textoAEnviar(input.value);
  if (!message) return;
  chat.add("u", message);
  input.value = "";
  send.disabled = true;
  const espera = chat.add("s", "thinking…");
  try {
    const res = await sendMessage({ session, message, ...parseSelection(select.value) });
    const tipo = res.headers.get("content-type") || "";
    if (!/text\/event-stream/i.test(tipo)) {
      const d = await res.json();
      espera.remove();
      for (const l of lineasDeRespuesta(d)) chat.add(l.tipo, l.texto);
      const vista = inspectorView(d.trace, presupuesto);
      if (vista) { presupuesto = vista.budget; renderInspector(vista, $); }
    } else {
      await leerStream(res, espera);
    }
  } catch (err) {
    const linea = textoDeError(err.message);
    if (espera.isConnected) espera.textContent = linea;
    else chat.add("s", linea);
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
