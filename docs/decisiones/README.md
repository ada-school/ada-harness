# Architecture decisions

Each file in this folder is a decision someone might question tomorrow, or one that would be expensive to undo. It keeps the reason. The rules that come out of them live where they are applied:

| Who applies them | Where they live |
|---|---|
| The harness agent, when building the front end | `harness/skills/frontend-tdd/arquitectura.md` |
| Claude Code, when developing this repo | `CLAUDE.md` and `.claude/rules/frontend.md` |
| The tests, on every `npm test` | The "Checked by" column below |

A decision that is checked nowhere is a suggestion. If you can write a test that fails when someone breaks it, write it.

## Index

| # | Decision | Status | Checked by |
|---|---|---|---|
| [0001](0001-interfaz-sin-compilacion.md) | The chat stays without a build step | Accepted | `tests/unit/arquitectura.test.js` |
| [0002](0002-formato-interno-y-proveedores.md) | One internal message format and one adapter per provider | Accepted | `tests/providers/` |
| [0003](0003-vista-pura-render-delgado.md) | In the chat, logic is pure and render does not decide | Accepted | `tests/unit/arquitectura.test.js`, `tests/unit/app/` |
| [0004](0004-tipos-con-jsdoc.md) | Types in JSDoc, checked by TypeScript, with no compile step | Replaced by 0011 for the engine. JSDoc remains on exports | `npm run typecheck`, `tests/unit/arquitectura.test.js` |
| [0005](0005-pruebas-sin-red.md) | Tests in three layers, with no keys and no network | Accepted | `tests/run.js`, CI with no secrets |
| [0006](0006-sandbox-y-archivos-protegidos.md) | Tools do not leave the workspace and do not touch secrets | Accepted | `tests/unit/tools.test.js` |
| [0007](0007-casos-de-uso-y-tdd.md) | The front end is built with use cases and tests first | Accepted | `tests/unit/casos-de-uso.test.js` |
| [0008](0008-agentes-por-archivo.md) | An agent is a file and an entry in routing.json | Accepted | `tests/unit/agentes.test.js` |
| [0009](0009-validacion-de-herramientas.md) | The server validates each tool's arguments | Accepted | `tests/unit/validation.test.js`, `tests/unit/harness.test.js` |
| [0010](0010-comando-unico.md) | One command for the chat and the terminal | Accepted | `tests/unit/http-cli.test.js`, `tests/unit/arquitectura.test.js` |
| [0011](0011-ingles-typescript-y-librerias.md) | English, TypeScript in phases, and no React for the chat | Accepted as the program | [`docs/BACKLOG.md`](../BACKLOG.md), phase by phase |
| [0012](0012-respuesta-en-trozos.md) | A turn can arrive in pieces, and JSON stays the default | Accepted | `tests/unit/app/conversacion.test.js`, `tests/integration/server.test.js` |

The backlog of what comes next, and of what this review left out, is in [`docs/BACKLOG.md`](../BACKLOG.md).

## How to write one

Copy this template to `NNNN-short-title.md`, with the next free number. A replaced decision is not deleted: change its status to "Replaced by NNNN" and let the new one explain what changed.

```markdown
# NNNN. Title in one sentence

**Status:** proposed | accepted | replaced by NNNN. Month and year.

## Context
What the problem was, and which constraints matter.

## Decision
What we do, in the present tense.

## Consequences
What we gain, what it costs, what is now forbidden.

## Checked by
The test or command that fails if someone breaks the decision.

## When to revisit
The signals that would make us change it.
```
