# 0005. Pruebas en tres capas, sin claves ni red

**Estado:** aceptada, octubre de 2026.

## Contexto

El harness habla con tres APIs y ejecuta herramientas sobre el disco. Una prueba que llama a una API real cuesta dinero, falla cuando la red falla y no corre en CI sin secretos. Una prueba que escribe en `workspace/` deja basura.

## Decisión

Tres capas, cada una en su carpeta, y `node tests/run.js <capa>` para correr una:

| Capa | Qué prueba | Con qué |
|---|---|---|
| `tests/unit/` | Funciones puras: herramientas, contexto, ventana, chat, HTTP, terminal, arquitectura, trazabilidad | Nada externo |
| `tests/providers/` | La traducción de cada adaptador | `fakeFetch` para Claude y Gemini, un servidor HTTP falso que imita a Ollama |
| `tests/integration/` | El servidor real de punta a punta | Servidor en un puerto libre, Ollama falso |

- Ninguna prueba usa una clave real ni sale a internet.
- Cada prueba que toca disco trabaja en un workspace temporal (`ADA_WORKSPACE`) y en una memoria temporal (`ADA_MEMORY`), ver `tests/helpers/workspace.js`. Correr las pruebas no deja rastro en el repo.
- Las simulaciones siguen el formato documentado de cada API, no lo que nos gustaría que devolviera.
- Solo `node:test` y `node:assert`. Sin frameworks de pruebas.

## Consecuencias

- `npm test` corre en segundos, en cualquier máquina y en CI.
- Si una API cambia su formato, las pruebas siguen verdes. Antes de un taller, haz un turno real con tu clave.

## Se verifica en

`tests/run.js` y CI, que corre sin secretos en Node 18, 20 y 22.

## Cuándo revisarla

Si aparece un error que solo una llamada real habría detectado. La respuesta sería una cuarta capa opcional (`tests/live/`), que corre solo con una clave presente y nunca en CI.
