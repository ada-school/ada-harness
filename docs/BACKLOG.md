# Backlog

Programa de noviembre de 2026. La lengua del repositorio pasa a inglés. El README en español se conserva. TypeScript reemplaza el JSDoc, un módulo por vez. El chat no pasa a React. El detalle en inglés está debajo. La decisión es la [0011](decisiones/0011-ingles-typescript-y-librerias.md).

## Resumen

- Inglés en código, comentarios, interfaz, agentes y documentación. `README.md` en inglés y `README.es.md` con esta guía en español.
- Los errores que ve una persona pasan a inglés, con el texto español conservado y `ADA_LANG` para elegirlo. No empieza dentro de un módulo de TypeScript.
- TypeScript estricto, compilado, sin cambiar el comportamiento. `npm test` verde en cada paso.
- Una sola librería de runtime cuando toque: Ajv, para el esquema de las herramientas. El resto sigue en la biblioteca de Node.
- React, Express, Commander y una jerarquía de clases no entran.

---

# Program

English is the language of the repo. Spanish stays in `README.es.md`. TypeScript becomes the source language one module at a time. The chat stays a single page of HTML, CSS, and plain modules.

This file is the plan. A phase is done only when its exit checks pass. Do not start phase 2 inside a phase 1 pull request.

## Already shipped

- [x] One command, `ada`, for the chat, a turn, and layer weights. Decision 0010.
- [x] Tool arguments checked before they run. Decision 0009.
- [x] Symlink escapes rejected. Decision 0006.
- [x] `.env.example`, `.gitignore`, and `ADA_WORKSPACE` so the harness can build another repo.

## Rules for every phase

1. One pull request, one intention. Tests stay green. `npm test` is the gate.
2. A move to English or to TypeScript does not change behavior. If a test fails, the migration is wrong.
3. No new runtime dependency unless this file names it.
4. User-facing docs change in both languages in the same pull request.
5. If `AGENTS.md`, `harness/system.md`, a skill description, or a tool definition changes, run `npm run capas` and update the figures in both READMEs.
6. There are no classes in `src/`. Do not introduce any. The loop, the providers, and the tools are functions. Grouping them into classes would hide the path a reader is supposed to follow.

## What we will not adopt

| Proposal | Decision |
|---|---|
| React, Preact, Vite, Tailwind | No. The chat is one screen. Logic is pure and tested in Node ([0003](decisiones/0003-vista-pura-render-delgado.md)). A component library would be larger than the UI and would add a build just for the browser. Reopen only when a second screen exists or the model must return UI. Decision [0001](decisiones/0001-interfaz-sin-compilacion.md) still holds for `app/`. |
| Express or Fastify | No. `src/server.js` routes the API and static files. A framework would hide that. |
| Commander or yargs | No. `node:util` `parseArgs` already covers `serve`, `run`, and `capas`. |
| dotenv | No. `loadEnvFile()` covers this `.env`. |
| A class hierarchy for providers or tools | No. A provider is a plain object that matches the `Provider` interface in `src/types.ts`. |
| Publishing to the npm registry | Not in this program. The package name is not reserved. Do not document `npx ada-harness` against the registry. |

## Libraries

Node's own libraries stay: `node:http`, `node:fs`, `node:test`, `node:util` `parseArgs`, global `fetch`.

| Package | When | Why |
|---|---|---|
| `typescript`, `@types/node` | Already dev dependencies | They typecheck JSDoc today. Phase 2 makes them compile. |
| `ajv` | Phase 3 only | Tool definitions are already JSON Schema, which is the wire format Anthropic and Gemini expect. Ajv checks that schema. Rewriting every tool in Zod would add a second schema and a JSON Schema exporter. The hand-written checker in `src/validation.ts` stays until Phase 3. |

## Phase 1. English, and keep the Spanish README

Goal: a reader who opens the repo on GitHub sees English. The Spanish guide does not disappear.

- [x] Copy the current `README.md` to `README.es.md` with no rewrites.
- [x] Write `README.md` in English. Same structure, same commands, same figures from `npm run capas`.
- [x] Translate `CLAUDE.md`, `AGENTS.md`, and `harness/system.md`.
- [x] Translate `harness/memory/profile.md` and `harness/memory/preferences.md`.
- [x] Translate skill and agent frontmatter descriptions.
- [x] Translate skill and agent bodies.
- [x] Translate UI strings in `app/index.html` and `app/js/`. Update the use cases in `docs/casos-de-uso/` and the tests that match those strings. A translated string that a test asserts is a behavior change of the text, so update the test in the same commit.
- [x] Translate comments in `src/`, `harness/tools/index.js`, and `tests/`. Do not rename exported functions in this phase. Spanish names such as `ayuda` and `abiertoALaRed` move to English in Phase 2, next to their types, so the diff stays reviewable.
- [x] Translate `docs/decisiones/` and `docs/taller/`. `docs/Anatomía de un Agente.html` is a published export. Leave it until it is republished on purpose.
- [x] `CLAUDE.md` writing rule switches to English for the whole repo, with the exceptions named in that rule.
- [x] Run `npm run capas` after `AGENTS.md` and `harness/system.md`. Put the new figures in both READMEs. Run it again when memory or skill descriptions change.

Exit: `npm test` passes. `README.es.md` still explains install, `ADA_WORKSPACE`, and the command. No file under `src/` or `app/` changed its control flow.

## Phase 2. TypeScript, one module at a time

Goal: `src/` and `harness/tools/` are `.ts`. The compiled output is what Node runs. Behavior stays the same. Decision 0004 is replaced for the engine only. `app/` stays JavaScript, per decision 0001.

Order, each as its own pull request. Tests for that module move with it. Steps 1–9 kept a generated `.js` beside each source. Step 10 deleted those copies.

1. [x] `src/types.ts`. The JSDoc typedefs are exported types and `Provider` is an interface. Nothing imports a value from this file. JSDoc keeps the `.js` specifier. `npm start` still runs the JavaScript sources.
2. [x] `src/config.ts`. Same exports, including `abiertoALaRed`. Node 18 imports the generated `src/config.js`. `npm start` still runs `bin/ada.js`.
3. [x] `src/validation.ts`. Same export, `validateInput`. Spanish error strings stay. Node runs the generated `src/validation.js`. Still the current checker, not Ajv.
4. [x] `src/window.ts`. Same exports. Spanish strings that the file prints stay, including the compaction prompt. Node runs the generated `src/window.js`.
5. [x] `src/context.ts`. Same exports, including `sinFrontmatter`. Spanish strings stay, including "Skills disponibles" and "Memoria por tema". Node runs the generated `src/context.js`.
6. [x] `src/providers/` (`anthropic`, `gemini`, `ollama`, `index`). Same exports. Spanish strings stay, including "Proveedor desconocido". Node runs the generated `.js` files.
7. [x] `src/http/` (`static`, `api`). Same exports, including `peticionPermitida`. Spanish strings stay, including "JSON inválido", "host no permitido", "origen no permitido", and "message requerido". Node runs the generated `.js` files.
8. [x] `harness/tools/index.ts`. Same exports, including `esDireccionInterna` and `urlPublica`. Spanish tool descriptions stay.
9. [x] `src/harness.ts`, `src/cli.ts`, `src/server.ts`. `bin/ada.js` stays a thin JS file. `server.ts` keeps `createServer` and `listen`. Spanish startup strings stay, including "ADA Harness en", "Con clave", "Ningún proveedor listo", and "Atención: ADA_HOST".
10. [x] The runner is `dist/`. `npm start`, `npm run cli`, and `npm run capas` build, then run `bin/ada.js`, which imports `dist/`. `dist/` is gitignored. Beside-source `.js` files are gone. `npm install` is required.

Compiler:

- `npm run build` (`tsconfig.build.json`) writes `dist/` with `rootDir` `.` and `noImplicitAny` on. `src/types.ts` exports no runtime value. Relative `.js` specifiers are preserved, so `dist/src/harness.js` imports `dist/harness/tools/index.js`.
- `npm start`, `npm run cli`, and `npm run capas` run the files in `dist/`. `bin/ada.js` stays the bin.
- `npm install` is required to run, because TypeScript must compile. Node 18, 20, and 22 stay. Do not depend on type stripping, which is not available on Node 18.
- `dist/` is gitignored. CI runs `npm ci`, `npm run build`, then `npm test`.
- Tests stay on `node:test` and import `dist/`. `npm test` builds first. The main `tsconfig.json` still does not emit, and `noImplicitAny` stays off there because `app/` and the tests are JavaScript.

Exit: `npm run build && npm test` passes on a clean install. `node src/server.js` is no longer the documented command. Both READMEs say `npm install` then `npm start`. Decision 0004 is marked replaced by 0011.

## Phase 3. Ajv for tool arguments

Goal: delete the hand-written subset in `src/validation.ts` only if Ajv accepts every schema the tools already publish and rejects the same bad inputs the current tests name.

- [x] Add `ajv` as a runtime dependency. Pin the version. No other packages. The pin is `ajv` 8.17.1.
- [x] Keep `additionalProperties: false` and the closed failure on a malformed schema (decision 0009).
- [x] The existing tests in `tests/unit/validation.test.js` and `tests/unit/harness.test.js` are the contract. They move to TypeScript if Phase 2 already moved them. They do not get weaker to fit the library.
- [x] If a tool schema needs a keyword Ajv supports and the old checker does not, add that keyword in this phase only, with a new test. No tool schema needed a new keyword.

Exit: `src/validation.ts` is a thin Ajv wrapper, or it stays custom if Ajv cannot match the tests without a larger dependency. Do not keep both checkers.

## Phase 4. Product work, after the move

These are the known limits. None of them start before Phase 2 is finished, so they are not written twice.

- [x] Streaming (SSE) on `/api/chat` and in the terminal. Ollama sends text as it arrives. Claude and Gemini still send the finished reply as one piece. A request without `Accept: text/event-stream` still gets JSON.
- [x] Session history on disk. `.sessions/sessions.json`, moved with `ADA_SESSIONS`. The same browser keeps the session id. The page still starts empty after a reload.
- [x] Token counts from the provider API, beside the 4-character estimate. The inspector shows the API's input and output next to the estimate. Compaction still uses the estimate. No extra `count_tokens` call.
- [x] A sandbox for `run_command`. On macOS, Seatbelt: the process can read and write the workspace, and it can read system libraries and its own install prefix. It cannot read the home directory or write outside the workspace. Linux is still a directory and a timeout. Not a container.
- [x] Prompt caching on providers that offer it. Claude sends a top-level `cache_control`. The inspector still shows the full window: the cached tokens are added back to `input_tokens`. Gemini 2.5 and newer caches on its own. Ollama has no prompt cache. It lowers cost, not window size.

## Phase 5. Error messages in English, Spanish kept

Goal: text a person reads when something fails is English by default. The same sentences stay available in Spanish. No new dependency.

This phase does not start inside a TypeScript slice. It starts after Phase 2. It does not wait for Ajv or the product work.

- [x] One module and two catalogs, `en` and `es`. A function looks up a key. No i18n library. That module is `src/text.ts`.
- [x] English is the default. `ADA_LANG=es` selects Spanish. A later change can let the chat send the choice. The first change is the env var.
- [x] Cover the errors a person reads: missing keys, provider failures (`Falta …`, `Gemini no respondió`, `Gemini terminó con`, `Ollama no responde`), an unknown provider, invalid JSON, CLI errors, and the validation sentences the server returns.
- [x] Leave out of this phase: tool descriptions, the skills and memory index headers, and the compaction prompt. Those travel in the prompt and change the layer weights. Sandbox sentences such as `Ruta fuera de` and the startup banner stay Spanish too.
- [x] Tests assert the English sentence by default and the current Spanish sentence when `ADA_LANG=es`.

Exit: with `ADA_LANG` unset, or set to `en`, the errors are English. With `ADA_LANG=es`, they are the sentences the code prints today. `npm test` passes.

## How to pick up the next slice

Phase 4 is done. There is no next slice in this file.
