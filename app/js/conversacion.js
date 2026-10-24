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
 * CU-01.3, CU-01.4 y CU-02.6: las líneas que se agregan cuando responde POST /api/chat.
 * La respuesta del modelo pasa tal cual: chat.js la inserta como texto.
 * @param {{ text?: string, error?: string, reset?: boolean }} respuesta
 * @returns {Linea[]}
 */
export function lineasDeRespuesta(respuesta) {
  if (respuesta.error) return [{ tipo: "s", texto: textoDeError(respuesta.error) }];
  /** @type {Linea[]} */
  const lineas = [];
  if (respuesta.reset) lineas.push({ tipo: "s", texto: "Cambiaste de proveedor: empezó una conversación nueva." });
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
  if (!proveedor) return "Conversación nueva.";
  return `Ahora hablas con ${proveedor.label} (${modelo || proveedor.model}). Conversación nueva: el loop, las capas y las herramientas son los mismos; solo cambia el adaptador de src/providers/.`;
}

/**
 * CU-01.6 El campo crece con el texto hasta 160 px.
 * @param {number} altoDelContenido scrollHeight del campo
 */
export const altoDelCampo = (altoDelContenido) => `${Math.min(160, altoDelContenido)}px`;
