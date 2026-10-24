# 0008. Un agente es un archivo y una entrada en routing.json

**Estado:** aceptada, octubre de 2026.

## Contexto

Agregar un subagente exigía tocar tres lugares: su prompt, `routing.json` y la lista de agentes escrita a mano dentro de `src/harness.js`. Olvidar el tercero dejaba un agente que el modelo no podía pedir. Además todos los subagentes usaban el modelo rápido, también para implementar código.

## Decisión

- Un agente es `harness/agents/<nombre>.md`, con frontmatter `name` y `description` y el prompt de sistema en el cuerpo.
- `routing.json` → `agents.<nombre>` declara qué herramientas ve, su tope de iteraciones y su modelo: `"fast"` (por defecto) o `"main"`.
- La herramienta `spawn_agent` se arma en cada turno desde ese índice: nombre y descripción de cada agente declarado. Es el mismo patrón que los skills: índice adentro, contenido afuera.
- Solo el agente principal lanza subagentes. Un subagente no puede lanzar otro.
- Los mismos roles se ofrecen a Claude Code en `.claude/agents/`, como envoltorios que leen el archivo de `harness/agents/`. El prompt vive en un solo lugar.

| Agente | Para qué | Herramientas | Modelo |
|---|---|---|---|
| `researcher` | Explorar y resumir | leer, listar, web | rápido |
| `reviewer` | Revisar un cambio concreto | leer, listar, comandos | rápido |
| `frontend` | Implementar pantallas con casos de uso y pruebas primero | leer, listar, escribir, comandos, skills | principal |
| `qa` | Revisar el proyecto entero contra decisiones, casos de uso y pruebas | leer, listar, comandos, skills | principal |

## Consecuencias

- Agregar un agente es un archivo y una entrada. Nada de código.
- Cada agente nuevo suma su descripción a la definición de `spawn_agent`, que el modelo lee en cada llamada. Por eso las descripciones son de una línea.

## Se verifica en

`tests/unit/agentes.test.js`: cada agente de `routing.json` tiene su archivo con `name` y `description`, usa solo herramientas que existen, y aparece en `spawn_agent`.

## Cuándo revisarla

Si un agente necesita algo que no es un prompt más herramientas (por ejemplo, otro proveedor o un loop distinto).
