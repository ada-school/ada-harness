# AGENTS.md

Este archivo se concatena al system prompt en cada llamada. Es la capa de guía del proyecto: lo que cualquier agente debe saber antes de tocar el código. Mantenlo corto. Una regla aquí vale más que repetirla en cada mensaje.

## Sobre este proyecto

- Nombre: ADA Harness (plantilla). Reemplaza esta sección con la descripción de tu proyecto.
- Stack: Node 18+, sin dependencias para correr. Si agregas una, escribe antes la decisión en `docs/decisiones/`.
- Todo el trabajo del agente ocurre dentro de `workspace/`. Fuera de esa carpeta solo se lee.

## Comandos

- Correr el chat: `node src/server.js`
- Correr un turno desde la terminal: `node src/harness.js "tu mensaje"`
- Tests: (agrega el comando de tu proyecto)

## Reglas de trabajo

1. Antes de escribir código, lee el archivo que vas a cambiar. No reconstruyas contenido de memoria.
2. Cambios pequeños y verificables. Un turno, una intención.
3. Si una tarea tiene más de 3 pasos, escribe el plan en `workspace/PLAN.md` y avanza marcando cada paso.
4. Investigación, revisión, front end y QA van en subagentes (`spawn_agent`). No llenes el contexto principal con resultados crudos.
5. Si algo falla, reporta el error exacto. No lo tapes con un intento distinto en silencio.
6. Escribe en español neutro, sin guiones conectores. Usa comas, puntos o dos puntos.
7. Front end: primero el caso de uso, después la prueba, al final el código (skill `frontend-tdd`).

## Qué no tocar

- `harness/system.md` y `harness/routing.json` solo cambian con aprobación humana.
- Nunca escribas secretos en memoria ni en `workspace/`.
