# CU-01 Conversar con el agente

**Actor:** quien usa el chat, en un taller o en su máquina.
**Objetivo:** pedirle algo al agente y leer su respuesta.
**Precondiciones:** el servidor corre y hay al menos un modelo disponible (CU-02).
**Disparador:** la persona escribe en el campo de texto.

## Flujo principal

1. La persona escribe un mensaje y presiona Enter.
2. El chat muestra su mensaje y "pensando…", y deshabilita Enviar.
3. El servidor corre el turno completo: puede ser varias llamadas al modelo y varias herramientas.
4. El chat reemplaza "pensando…" por la respuesta y actualiza el inspector (CU-03).
5. Enviar vuelve a estar disponible y el cursor vuelve al campo.

## Flujos alternos

- **2a.** Si el campo está vacío o solo tiene espacios, no pasa nada.
- **3a.** Si el servidor responde con error o no responde, el chat muestra el motivo y la persona puede volver a escribir.

## Criterios de aceptación

- **CU-01.1** Dado texto en el campo, cuando la persona presiona Enter, entonces el mensaje se envía; con Shift+Enter, o mientras compone texto con un método de entrada (IME), Enter agrega un salto de línea y no envía.
- **CU-01.2** Dado un campo vacío o con solo espacios, cuando la persona intenta enviar, entonces no se envía nada; con texto, se envía sin los espacios de los extremos.
- **CU-01.3** Dada una respuesta del modelo que contiene HTML, cuando se muestra, entonces aparece como texto literal y no se interpreta.
- **CU-01.4** Dado que el servidor responde con error o no responde, cuando termina la espera, entonces la conversación muestra "error: " y el motivo.
- **CU-01.5** Dado un segundo mensaje en la misma conversación, cuando llega al modelo, entonces incluye completo el turno anterior, herramientas incluidas.
- **CU-01.6** Dado un mensaje largo, cuando la persona escribe, entonces el campo crece con el texto hasta 160 px y después hace scroll.
- **CU-01.7** (manual) Dado un mensaje enviado, mientras llega la respuesta, entonces la conversación muestra "pensando…" y Enviar queda deshabilitado. Verificación: con Ollama corriendo, enviar un mensaje y mirar el botón antes de la respuesta.

## Fuera de alcance

- Respuestas en streaming: el turno llega completo.
- Guardar la conversación entre reinicios del servidor.
