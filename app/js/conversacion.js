// La conversación (CU-01): cuándo enviar, qué texto enviar y qué agregar cuando responde el servidor.
// Funciones puras: deciden. main.js las conecta y chat.js pinta.

import { parseSelection } from "./selector.js";

/** @typedef {{ tipo: "u" | "a" | "s", texto: string }} Linea usuario, asistente o sistema */

/**
 * CU-01.1 Enter envía. Shift+Enter, o Enter mientras se compone texto con un IME, es salto de línea.
 * @param {{ key: string, shiftKey?: boolean, isComposing?: boolean }} tecla
 */
export const debeEnviar = (tecla) => tecla.key === "Enter" && !tecla.shiftKey && !tecla.isComposing;

/**
 * CU-01.9 The session id this browser keeps. A saved id wins; otherwise the new one.
 * @param {string | null} guardado
 * @param {string} nuevo
 * @returns {string}
 */
export const idDeSesion = (guardado, nuevo) => guardado || nuevo;

/**
 * CU-01.2 El texto a enviar, sin espacios en los extremos; null si no queda nada.
 * @param {string} texto
 * @returns {string | null}
 */
export const textoAEnviar = (texto) => texto.trim() || null;

/**
 * CU-01.4 Cómo se muestra un error, venga del servidor o de la red.
 * @param {string} motivo
 */
export const textoDeError = (motivo) => `error: ${motivo}`;

/**
 * CU-01.8 Splits a Server-Sent Events buffer into complete events.
 * An event that has not finished stays in `rest`.
 * @param {string} buffer
 * @returns {{ events: { event: string, data: any }[], rest: string }}
 */
export function tomarEventos(buffer) {
  const partes = buffer.split("\n\n");
  const rest = partes.pop() ?? "";
  /** @type {{ event: string, data: any }[]} */
  const events = [];
  for (const parte of partes) {
    if (!parte.trim()) continue;
    let event = "message";
    /** @type {string[]} */
    const data = [];
    for (const linea of parte.split("\n")) {
      if (linea.startsWith("event:")) event = linea.slice(6).trim();
      else if (linea.startsWith("data:")) data.push(linea.slice(5).trim());
    }
    if (data.length) events.push({ event, data: JSON.parse(data.join("\n")) });
  }
  return { events, rest };
}

/**
 * CU-01.8 What the conversation shows after one event.
 * Pieces append. The closing event keeps that text and attaches the trace.
 * With no pieces yet, the closing text is the whole reply.
 * @param {{ texto: string, listo: boolean, trace: any, error: string | null, reset: boolean }} estado
 * @param {{ event: string, data: any }} evento
 * @returns {{ texto: string, listo: boolean, trace: any, error: string | null, reset: boolean }}
 */
export function aplicarEvento(estado, evento) {
  if (evento.event === "delta") return { ...estado, texto: estado.texto + (evento.data?.text || "") };
  if (evento.event === "done") {
    return {
      ...estado,
      texto: estado.texto || evento.data?.text || "",
      listo: true,
      trace: evento.data?.trace ?? null,
      reset: Boolean(evento.data?.reset),
    };
  }
  if (evento.event === "error") return { ...estado, listo: true, error: evento.data?.error || "" };
  return estado;
}

/**
 * CU-02.6 The notice when the server started a new conversation.
 * @returns {string}
 */
export const avisoDeReinicio = () => "You switched providers: a new conversation started.";

/**
 * CU-01.3, CU-01.4 y CU-02.6: las líneas que se agregan cuando responde POST /api/chat.
 * La respuesta del modelo pasa tal cual: chat.js la inserta como texto.
 * @param {{ text?: string, error?: string, reset?: boolean }} respuesta
 * @returns {Linea[]}
 */
export function lineasDeRespuesta(respuesta) {
  if (respuesta.error) return [{ tipo: "s", texto: textoDeError(respuesta.error) }];
  /** @type {Linea[]} */
  const lineas = [];
  if (respuesta.reset) lineas.push({ tipo: "s", texto: avisoDeReinicio() });
  lineas.push({ tipo: "a", texto: respuesta.text || "" });
  return lineas;
}

/**
 * CU-02.6 El aviso al elegir otro modelo en el selector.
 * @param {{ name: string, label: string, model: string }[]} proveedores de GET /api/providers
 * @param {string} valor el del selector, "proveedor|modelo"
 * @returns {string}
 */
export function avisoDeCambio(proveedores, valor) {
  const { provider, model: modelo } = parseSelection(valor);
  const proveedor = proveedores.find((p) => p.name === provider);
  if (!proveedor) return "New conversation.";
  return `You are now talking to ${proveedor.label} (${modelo || proveedor.model}). New conversation: the loop, the layers, and the tools are the same; only the adapter in src/providers/ changes.`;
}

/**
 * CU-01.6 El campo crece con el texto hasta 160 px.
 * @param {number} altoDelContenido scrollHeight del campo
 */
export const altoDelCampo = (altoDelContenido) => `${Math.min(160, altoDelContenido)}px`;
