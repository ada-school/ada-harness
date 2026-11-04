# CLAUDE.md

Guide for Claude Code when you develop this repo: the harness, its chat, and its documentation.

## Use the harness, or change it

- Someone building software with the harness edits `.env` (a copy of `.env.example`), `AGENTS.md`, and `harness/memory/profile.md`. `ADA_WORKSPACE` points at their repo. They do not need to touch `src/`.
- This file is for whoever changes the engine. The agent that runs inside the harness does not read it.

## Two guides, two agents

- `AGENTS.md` is the guide for the agent that runs **inside** the harness. It is concatenated to that agent's system prompt on every call and tells it to work only in `workspace/`. It is a template: each person replaces it with their project.
- This file is for you. You work on the whole repo. Because this `CLAUDE.md` exists, Claude Code does not load `AGENTS.md`: read it when the task touches it.
- Every word of `AGENTS.md`, `harness/system.md`, the `description` of skills and agents, and the tool definitions travels on every harness call. Those figures show up in the README and in the workshop decks. If you change any of them, run `npm run capas` and update the figures wherever they appear.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Chat at http://localhost:3000. This is `ada serve`. It compiles `dist/` and then runs `bin/ada.js`. `npm install` comes first |
| `npm run cli -- "message"` | One turn from the terminal. This is `ada run` |
| `npm run capas` | Weight of each fixed layer of the main agent, without calling a model |
| `node bin/ada.js --help` | The one command: chat, one turn, or layer weights |
| `npm test` | All tests: unit, providers, and integration |
| `npm run test:unit` | One layer (also `test:providers`, `test:integration`) |
| `npm run trazabilidad` | Each use-case criterion against the tests that cover it |
| `npm run typecheck` | Types with TypeScript. It builds `dist/` first, then checks `src/`, `app/`, and the tests |
| `npm run check` | Types and tests. It has to pass before you call something done |

## Where each thing lives

| For | Look at |
|---|---|
| Configure the harness for a repo | `.env.example`, `AGENTS.md`, `ADA_WORKSPACE` |
| Why the project is this way | `docs/decisiones/` (one decision per file, with the test that checks it) |
| What each screen must achieve | `docs/casos-de-uso/` |
| How the front end is built | `harness/skills/frontend-tdd/SKILL.md` (process) and `arquitectura.md` (rules) |
| The loop, the context, and the window | `src/harness.ts`, `src/context.ts`, `src/window.ts`. Node runs the compiled files under `dist/` |
| The command | `bin/ada.js` imports `dist/`. Arguments in `src/cli.ts`. HTTP server in `src/server.ts` |
| Model providers | `src/providers/`, the `Provider` interface in `src/types.ts`. Node runs `dist/src/providers/` |
| Tools and the sandbox | `harness/tools/index.ts` (Node runs `dist/harness/tools/index.js`), `src/config.ts`, `src/validation.ts` (Node runs `dist/src/`) |
| Harness agents | `harness/agents/*.md` and `harness/routing.json` → `agents` |
| The chat | `app/` (no build) |
| Tests | `tests/unit/`, `tests/providers/`, `tests/integration/`, `tests/helpers/` |

## Rules of this repo

1. **One runtime dependency.** `ajv` checks tool arguments (decision 0009). `npm install` is required because `npm start` compiles the engine. TypeScript is a development dependency. Another runtime dependency needs a decision in `docs/decisiones/` first.
2. **Node 18 or newer.** CI runs 18, 20, and 22. Do not use APIs newer than Node 18.
3. **One file, one job.** If a file starts doing two things, split it and update the README tree.
4. **Types in JSDoc.** Every exported function has its JSDoc block (`arquitectura.test.js` watches this), with `@param` on each parameter and `@returns` when the type is not inferred from the body. `npm run typecheck` stays clean.
5. **Tests first.** A behavior change starts with a test that fails for the expected reason. On the front end, the test names the criterion (`CU-01.2`). For behavior that already existed, break the code on purpose and confirm the test catches it.
6. **Tests with no network and no keys.** Simulate with `tests/helpers/` (decision 0005).
7. **Do not weaken the sandbox.** A change to `inside()`, `isProtected()`, or a tool brings its test in `tests/unit/tools.test.js` (decision 0006).
8. **Decisions stay current.** If you change something a decision regulates, update that decision or write a new one in the same change.
9. **Language.** Write English. `README.es.md` stays the Spanish guide. `docs/Anatomía de un Agente.html` stays until it is republished. Exported names such as `ayuda` stay. Error sentences a person reads come from `src/text.ts`: English unless `ADA_LANG=es`. Tool descriptions, index headers, the compaction prompt, the help text, the startup banner, and test titles stay Spanish.

## How to make a change

1. Would a person notice it on screen? Follow `harness/skills/frontend-tdd/SKILL.md`: use case, red test, minimum code, cleanup. For long work, delegate to the `frontend` agent.
2. Does it touch the loop, the context, a provider, or a tool? Test first in `tests/unit/` or `tests/providers/`.
3. Run `npm run check`.
4. Update what the change left stale: the README tree and diagrams, this file, the table in `arquitectura.md`, the `npm run capas` figures.
5. Before calling a large change done, ask the `qa` agent for a review and fix its blockers.

## Agents for Claude Code

`.claude/agents/` has two wrappers. Their prompt lives in `harness/agents/`, the same prompt the harness uses: one place to maintain.

- `frontend`: implements or changes screens with use cases and tests first.
- `qa`: reviews the whole project against decisions, use cases, and tests. It does not edit.

## What not to change without asking

- `AGENTS.md` and `harness/system.md`: they change the workshop figures.
- `harness/routing.json`: budgets and tools for each agent.
- The order of the four blocks in the side panel in `app/index.html`: the workshop slides number them.
- `docs/Anatomía de un Agente.html`: it is the exported version of a published artifact. A change there is published separately.
