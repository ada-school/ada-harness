# 0002. Un formato interno de mensajes y un adaptador por proveedor

**Estado:** aceptada, octubre de 2026.

## Contexto

El harness habla con Claude, Gemini y Ollama. Cada API tiene su forma de representar un pedido de herramienta y su resultado: `tool_use` y `tool_result` en Claude, `functionCall` y `functionResponse` en Gemini, el rol `tool` en Ollama. Si el loop conociera esas diferencias, cada proveedor nuevo tocaría el corazón del harness.

## Decisión

- El historial se guarda siempre en un solo formato: el de bloques de la API de Anthropic (`text`, `tool_use`, `tool_result`). Está tipado en `src/types.js`.
- Cada proveedor vive en `src/providers/<nombre>.js` y cumple el contrato `Provider`: traduce el historial a su API y la respuesta de vuelta al formato interno.
- Lo que un adaptador necesita recordar entre llamadas se guarda en el bloque con un campo que empieza con `_` (por ejemplo `_gemini.thoughtSignature`). Ningún otro adaptador lo envía a su API.
- Cambiar de proveedor empieza una conversación nueva. Las firmas y los ids de una API no sirven en otra.

## Consecuencias

- El loop (`src/harness.js`) no tiene un solo `if` por proveedor.
- Agregar un proveedor es un archivo y una línea en `src/providers/index.js`.
- Claude casi no traduce, y eso es una ventaja de partida para Anthropic que aceptamos: el formato está bien documentado y cubre todo lo que el loop necesita.

## Se verifica en

`tests/providers/`: traducción de ida y vuelta, ids de herramientas, firmas de Gemini que vuelven intactas y campos privados que no salen hacia otra API.

## Cuándo revisarla

Si una API nueva necesita algo que el formato de bloques no puede expresar (por ejemplo, salidas de audio o herramientas que corren del lado del proveedor).
