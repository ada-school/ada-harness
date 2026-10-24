# Decisiones de arquitectura

Cada archivo de esta carpeta es una decisión que alguien podría cuestionar mañana, o que costaría caro deshacer. Guarda el porqué. Las reglas que salen de ellas viven donde se aplican:

| Quién las aplica | Dónde están |
|---|---|
| El agente del harness, al implementar front end | `harness/skills/frontend-tdd/arquitectura.md` |
| Claude Code, al desarrollar este repo | `CLAUDE.md` y `.claude/rules/frontend.md` |
| Las pruebas, en cada `npm test` | La columna "Se verifica en" de abajo |

Una decisión que no se verifica en ningún lado es una sugerencia. Si puedes escribir una prueba que falle cuando alguien la rompe, escríbela.

## Índice

| # | Decisión | Estado | Se verifica en |
|---|---|---|---|
| [0001](0001-interfaz-sin-compilacion.md) | El chat sigue sin paso de compilación | Aceptada | `tests/unit/arquitectura.test.js` |
| [0002](0002-formato-interno-y-proveedores.md) | Un formato interno de mensajes y un adaptador por proveedor | Aceptada | `tests/providers/` |
| [0003](0003-vista-pura-render-delgado.md) | En el chat, la lógica es pura y el render no decide | Aceptada | `tests/unit/arquitectura.test.js`, `tests/unit/app/` |
| [0004](0004-tipos-con-jsdoc.md) | Tipos en JSDoc revisados por TypeScript, sin compilar | Aceptada | `npm run typecheck`, CI |
| [0005](0005-pruebas-sin-red.md) | Pruebas en tres capas, sin claves ni red | Aceptada | `tests/run.js`, CI sin secretos |
| [0006](0006-sandbox-y-archivos-protegidos.md) | Las herramientas no salen del workspace ni tocan secretos | Aceptada | `tests/unit/tools.test.js` |
| [0007](0007-casos-de-uso-y-tdd.md) | El front end se construye con casos de uso y pruebas primero | Aceptada | `tests/unit/casos-de-uso.test.js` |
| [0008](0008-agentes-por-archivo.md) | Un agente es un archivo y una entrada en routing.json | Aceptada | `tests/unit/agentes.test.js` |

## Cómo escribir una

Copia esta plantilla en `NNNN-titulo-corto.md`, con el siguiente número libre. Una decisión reemplazada no se borra: cambia su estado a "Reemplazada por NNNN" y la nueva explica qué cambió.

```markdown
# NNNN. Título en una frase

**Estado:** propuesta | aceptada | reemplazada por NNNN. Mes y año.

## Contexto
Qué problema había y qué restricciones importan.

## Decisión
Qué hacemos, en presente.

## Consecuencias
Qué ganamos, qué cuesta, qué queda prohibido.

## Se verifica en
La prueba o el comando que falla si alguien rompe la decisión.

## Cuándo revisarla
Las señales que harían cambiarla.
```
