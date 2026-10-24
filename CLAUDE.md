# CLAUDE.md

Guía para Claude Code cuando desarrollas este repo: el harness, su chat y su documentación.

## Dos guías, dos agentes

- `AGENTS.md` es la guía del agente que corre **dentro** del harness. Se concatena a su system prompt en cada llamada y le dice que trabaje solo en `workspace/`. Es una plantilla: cada persona la reemplaza con su proyecto.
- Este archivo es para ti. Tú trabajas sobre el repo entero. Como existe este CLAUDE.md, Claude Code no carga AGENTS.md: léelo cuando la tarea lo toque.
- Cada palabra de `AGENTS.md`, `harness/system.md`, los `description` de skills y agentes y las definiciones de herramientas viaja en cada llamada del harness. Esas cifras aparecen en el README y en los decks del taller. Si cambias alguno, corre `npm run capas` y actualiza las cifras donde aparezcan.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Chat en http://localhost:3000. No necesita `npm install` |
| `npm run cli -- "mensaje"` | Un turno desde la terminal |
| `npm run capas` | Peso de cada capa fija del agente principal, sin llamar a un modelo |
| `npm test` | Todas las pruebas: unit, providers e integration |
| `npm run test:unit` | Una capa (también `test:providers`, `test:integration`) |
| `npm run trazabilidad` | Cada criterio de los casos de uso contra las pruebas que lo cubren |
| `npm run typecheck` | Tipos con TypeScript sobre el JSDoc, sin compilar |
| `npm run check` | Tipos y pruebas. Tiene que pasar antes de dar algo por terminado |

## Dónde vive cada cosa

| Para | Mira |
|---|---|
| Por qué el proyecto es como es | `docs/decisiones/` (una decisión por archivo, con la prueba que la verifica) |
| Qué tiene que lograr cada pantalla | `docs/casos-de-uso/` |
| Cómo se construye el front end | `harness/skills/frontend-tdd/SKILL.md` (proceso) y `arquitectura.md` (reglas) |
| El loop, el contexto y la ventana | `src/harness.js`, `src/context.js`, `src/window.js` |
| Proveedores de modelos | `src/providers/`, contrato `Provider` en `src/types.js` |
| Herramientas y sandbox | `harness/tools/index.js`, `src/config.js` |
| Agentes del harness | `harness/agents/*.md` y `harness/routing.json` → `agents` |
| El chat | `app/` (sin compilación) |
| Pruebas | `tests/unit/`, `tests/providers/`, `tests/integration/`, `tests/helpers/` |

## Reglas de este repo

1. **Cero dependencias para correr.** TypeScript es solo de desarrollo. Una dependencia nueva necesita antes una decisión en `docs/decisiones/`.
2. **Node 18 o superior.** CI corre 18, 20 y 22. No uses APIs más nuevas que Node 18.
3. **Un archivo, un trabajo.** Si un archivo empieza a hacer dos cosas, sepáralo y actualiza el árbol del README.
4. **Tipos en JSDoc.** Toda función exportada lleva su bloque JSDoc (lo vigila `arquitectura.test.js`), con `@param` en cada parámetro y `@returns` cuando el tipo no se infiere del cuerpo. `npm run typecheck` limpio.
5. **Pruebas primero.** Un cambio de comportamiento empieza con una prueba que falla por la razón esperada. En el front end, la prueba nombra el criterio (`CU-01.2`). Para comportamiento que ya existía, rompe el código a propósito y confirma que la prueba lo detecta.
6. **Pruebas sin red ni claves.** Simula con `tests/helpers/` (decisión 0005).
7. **No debilites el sandbox.** Un cambio en `inside()`, `isProtected()` o una herramienta trae su prueba en `tests/unit/tools.test.js` (decisión 0006).
8. **Decisiones vivas.** Si cambias algo que una decisión regula, actualiza la decisión o escribe una nueva en el mismo cambio.
9. **Escritura.** Español latinoamericano neutro, oraciones cortas, sin guiones como conectores: usa comas, puntos o dos puntos. Comentarios del código en español.

## Cómo hacer un cambio

1. ¿Lo nota una persona en pantalla? Sigue `harness/skills/frontend-tdd/SKILL.md`: caso de uso, prueba en rojo, código mínimo, limpieza. Para el trabajo largo, delega en el agente `frontend`.
2. ¿Toca el loop, el contexto, un proveedor o una herramienta? Prueba primero en `tests/unit/` o `tests/providers/`.
3. Corre `npm run check`.
4. Actualiza lo que el cambio dejó viejo: árbol y diagramas del README, este archivo, la tabla de `arquitectura.md`, las cifras de `npm run capas`.
5. Antes de dar por terminado un cambio grande, pide una revisión al agente `qa` y corrige sus bloqueantes.

## Agentes para Claude Code

`.claude/agents/` tiene dos envoltorios. Su prompt vive en `harness/agents/`, el mismo que usa el harness: hay un solo lugar que mantener.

- `frontend`: implementa o cambia pantallas con casos de uso y pruebas primero.
- `qa`: revisa el proyecto entero contra decisiones, casos de uso y pruebas. No edita.

## Qué no cambiar sin preguntar

- `AGENTS.md` y `harness/system.md`: cambian las cifras del taller.
- `harness/routing.json`: presupuestos y herramientas de cada agente.
- El orden de los cuatro bloques del panel lateral en `app/index.html`: las slides del taller los numeran.
- `docs/Anatomía de un Agente.html`: es la versión exportada de un artifact publicado. Un cambio ahí se publica aparte.
