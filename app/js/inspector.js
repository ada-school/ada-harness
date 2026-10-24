// Inspector de contexto (CU-03). inspectorView() convierte el trace de un turno en lo que se muestra
// (función pura, se prueba en Node); renderInspector() lo dibuja con textContent y no decide nada.

import { num, colorDeCapa } from "./format.js";

/**
 * Qué muestra el inspector de un turno; null si el turno no trae trace (terminó en error, CU-03.8).
 * @param {any} trace lo que devuelve POST /api/chat
 * @param {number} [presupuestoPrevio] si el trace no trae ventana, la última conocida
 */
export function inspectorView(trace, presupuestoPrevio = 120000) {
  if (!trace) return null;
  const budget = trace.budget || presupuestoPrevio;
  const capas = trace.lastContext?.layers || [];
  const total = capas.reduce((a, l) => a + l.tokens, 0);
  return {
    budget,
    modelo: trace.provider ? `proveedor: ${trace.provider} · ${trace.model}${trace.budget ? ` · ventana ${num(trace.budget)}` : ""}` : null,
    segmentos: capas.map((l) => ({ name: l.name, color: colorDeCapa(l.name), width: `${(l.tokens / budget * 100).toFixed(2)}%` })),
    usado: `~${num(total)} / ${num(budget)} tokens estimados (${(total / budget * 100).toFixed(1)}%)`,
    capas: capas.map((l) => ({ name: l.name, color: colorDeCapa(l.name), tokens: `~${num(l.tokens)}` })),
    contadores: { calls: String(trace.calls ?? 0), tools: String(trace.tools?.length ?? 0), intok: num(trace.lastContext?.usage?.input_tokens ?? 0) },
    eventos: eventos(trace),
  };
}

/**
 * Herramientas y eventos del loop, como texto plano. Sin ninguno, lo dice (CU-03.7).
 * @param {any} trace
 * @returns {{ cls: string, text: string }[]}
 */
function eventos(trace) {
  const lista = [
    ...(trace.tools || []).map((x) => ({
      cls: "tool",
      text: `${x.agent ? `[${x.agent}] ` : ""}${x.name}(${JSON.stringify(x.input).slice(0, 60)}) → ~${x.tokens} tok`,
    })),
    ...(trace.events || []).map((e) =>
      e.type === "compact" ? { cls: "cmp", text: `compactación: ${e.droppedMessages} mensajes → resumen de ~${e.summaryTokens} tok` }
      : e.type === "warning" ? { cls: "cmp", text: `aviso: ${e.text}` }
      : { cls: "sub", text: `subagente ${e.agent}: ${e.calls} llamadas, ${e.tools} herramientas` }),
  ];
  return lista.length ? lista : [{ cls: "empty", text: "Sin herramientas en este turno." }];
}

/**
 * Pinta la vista. No decide nada: todo lo que muestra ya viene calculado.
 * @param {NonNullable<ReturnType<typeof inspectorView>>} v
 * @param {(id: string) => HTMLElement} $
 */
export function renderInspector(v, $) {
  if (v.modelo) $("modelo").textContent = v.modelo;
  $("meter").replaceChildren(...v.segmentos.map((s) => {
    const i = document.createElement("i");
    i.style.background = `var(${s.color})`;
    i.style.flex = `0 0 ${s.width}`;
    i.title = s.name;
    return i;
  }));
  $("used").textContent = v.usado;
  $("layers").replaceChildren(...v.capas.map((c) => {
    const fila = document.createElement("div");
    fila.className = "layer";
    fila.style.setProperty("--c", `var(${c.color})`);
    const nombre = document.createElement("span"); nombre.textContent = c.name;
    const tokens = document.createElement("span"); tokens.textContent = c.tokens;
    fila.append(document.createElement("i"), nombre, tokens);
    return fila;
  }));
  $("calls").textContent = v.contadores.calls;
  $("tools").textContent = v.contadores.tools;
  $("intok").textContent = v.contadores.intok;
  $("events").replaceChildren(...v.eventos.map((e) => {
    const d = document.createElement("div");
    d.className = e.cls;
    d.textContent = e.text;
    return d;
  }));
}
