# 0011. English, TypeScript in phases, and no React

**Status:** accepted as the program, November 2026. Phase 1 is done. Phase 2 has landed for the engine: `src/` and `harness/tools/` are TypeScript, `npm run build` writes `dist/`, and `npm start` runs those files. `npm install` is required. Decision 0004 is replaced for the engine. `app/` stays JavaScript. Phase 3 has landed: `ajv` 8.17.1 is the only runtime dependency, and `src/validation.ts` is a thin wrapper. Phase 5 has landed for error sentences: English by default, Spanish when `ADA_LANG=es`. The first Phase 4 slice has landed: `/api/chat` and the terminal can stream the reply ([0012](0012-respuesta-en-trozos.md)).

## Context

The repo is a small harness: functions, one chat screen, zero runtime dependencies, types in JSDoc. The new direction is to make English the language of the project, to use TypeScript as the source language, to replace hand-rolled pieces with reliable libraries, and to consider React.

There are no classes to group. `src/` is functions and plain provider objects. A class tree would add structure a reader has to unfold before they can see the loop.

## Decision

- English becomes the language of code, comments, the UI, agent prompts, and docs. `README.es.md` keeps the Spanish guide. `README.md` becomes English in Phase 1.
- TypeScript replaces JSDoc one module at a time, with a compile step to `dist/`. `npm test` stays green on every step. `app/` is not part of that compile.
- The chat does not move to React. Decision 0001 still covers `app/`.
- Node's own libraries stay for HTTP, files, tests, and the command line. The only runtime library on the list is Ajv, in Phase 3, because tool definitions are already JSON Schema.
- The order and the exit check for each phase live in [`docs/BACKLOG.md`](../BACKLOG.md). A phase does not start inside another phase's pull request.

## Consequences

- `npm install` is required. `npm start` compiles the engine and then opens the chat. The only runtime dependency is `ajv`.
- Decision 0004 is replaced for the engine. The architecture test still requires JSDoc on every export, and it reads the TypeScript sources. The chat stays on JSDoc.
- Exported Spanish names are renamed in Phase 2, not during the translation, so a language pull request does not also move every import.
- Error sentences a person reads are English unless `ADA_LANG=es`. They live in `src/text.ts`. Tool descriptions, index headers, the compaction prompt, the help text, and the startup banner stay Spanish.

## Checked by

Each phase names its check in the backlog. Phase 1 is `npm test` with no control-flow change. Phase 2 is `npm run build && npm test`. Phase 5 is `npm test`: English by default, and the previous Spanish sentence when `ADA_LANG=es`. Phase 3 is the current validation tests against Ajv.

## When to revisit

A second screen, or UI the model must return, reopens React. A tool schema Ajv cannot check without extra packages reopens the choice of validator.
