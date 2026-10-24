# 0004. Tipos en JSDoc revisados por TypeScript, sin compilar

**Estado:** aceptada, octubre de 2026.

## Contexto

Queríamos que el editor autocomplete y que un error de nombre (`trace.call` en vez de `trace.calls`) se detecte antes de correr. Escribir el proyecto en TypeScript obliga a compilar, y eso rompe `node src/server.js` recién clonado (ver [0001](0001-interfaz-sin-compilacion.md)).

## Decisión

- El código sigue siendo JavaScript. Los tipos van en comentarios JSDoc.
- Los tipos compartidos viven en `src/types.js`: mensajes, bloques, `Provider`, `Trace`, `Routing`.
- `npm run typecheck` corre TypeScript en modo estricto sobre `src/`, `harness/tools/`, `app/js/` y `tests/`, sin generar archivos (`jsconfig.json`).
- Dos concesiones: parámetros sin anotar quedan como `any`, y en un `catch` se puede leer `e.message` sin chequeo previo.
- Un proveedor nuevo se anota con `@satisfies {Provider}`: si le falta un método, el chequeo falla.
- TypeScript es dependencia de desarrollo. Correr el harness no la necesita.

## Consecuencias

- Mismo código en el navegador, en Node 18 y en el editor.
- JSDoc es más verboso que TypeScript para tipos complejos.

## Se verifica en

`npm run typecheck` y el flujo de CI (`.github/workflows/ci.yml`).

## Cuándo revisarla

Si Node puede ejecutar TypeScript sin banderas en todas las versiones que soportamos, o si la [0001](0001-interfaz-sin-compilacion.md) cambia y ya hay un paso de compilación.
