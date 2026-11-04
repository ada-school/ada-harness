# 0001. The chat stays without a build step

**Status:** accepted, October 2026. The chat still has no build and imports no package. The engine compile is [0011](0011-ingles-typescript-y-librerias.md): `npm install`, then `npm start`. The engine's one runtime dependency is `ajv` ([0009](0009-validacion-de-herramientas.md)).

## Context

A proposal arrived to rewrite the interface with Preact, Tailwind v4, Vite, and TypeScript, around an engine that paints components from a JSON manifest (`ComponentNode` → `RenderEngine`). The stated goal was a better structure, more readable, easier to maintain, and with a test layer.

The goal is right. Before this change the chat was a single `index.html` with styles, logic, and the DOM mixed together, and there were no tests outside the model adapters.

## Decision

We took the goals of the proposal and not its tools. The chat stays HTML, one CSS file, and native ES modules that the browser loads as they are.

What did change:

| Goal of the proposal | How it was solved |
|---|---|
| Types | JSDoc checked by TypeScript in strict mode ([0004](0004-tipos-con-jsdoc.md)). The code stays JavaScript and runs without compiling. |
| Components | `app/js/`: small modules, each with one job. The logic is pure and render does not decide ([0003](0003-vista-pura-render-delgado.md)). |
| Design tokens | CSS variables in `app/styles.css`, with the same color per layer as the explainer. |
| Tests | Three layers (unit, providers, integration) and CI on Node 18, 20, and 22. The chat logic is tested in Node, with no browser ([0005](0005-pruebas-sin-red.md)). |
| Server structure | `src/` split by job: `config`, `window`, `cli`, `http/static`, `http/api`. |

## Why not the tools

1. **The workshop depends on a short install.** `npm install`, then `npm start`, compiles the engine ([0011](0011-ingles-typescript-y-librerias.md)). The chat itself still has no build and imports no package. Vite 8 asks for Node 20.19 or 22.12 and up, and the proposed set adds about 150 packages to the lockfile, several with native binaries per platform. In a room with shared Wi-Fi and Windows laptops, that is what breaks first.
2. **The framework would be larger than the app.** The chat was about 300 lines of JavaScript when this decision was made. At that size, a framework adds more surface to understand than it saves.
3. **The manifest solves a different problem.** An engine that paints screens from JSON helps when screens are data: many configurable variants, or an interface the agent generates. The chat is one fixed screen. Putting an interpretation layer between the code and what you see contradicts the project's principle: everything is text you can read and follow.
4. **The proposed engine had gaps.** Props such as `Record<string, any>` (the types are lost right at the edge), index keys on lists, no schema that validates the manifest before painting it, no state or event model, and no tests. If the manifest ever arrived from a model's output, the missing validation would be an injection surface.
5. **The palette.** The proposal used a generic blue. In the harness, each layer's color is the same in the explainer and in the inspector, and that match is part of what it teaches.

## When to revisit

| Signal | What we would do |
|---|---|
| The chat grows to several screens (saved sessions, a skill editor, a memory panel), or shared state between modules starts to be duplicated | Preact with `htm`, copied into `app/vendor/` as one file. Components with state, no build and no `npm install`. |
| The agent needs to return interface (forms, tables, cards) | A manifest, this time with a validated schema, a closed list of components, and tests that a malicious manifest runs nothing. |
| The team that maintains the repo already works in TypeScript and the interface has grown | Vite and TypeScript for `app/`, with the server serving `app/dist/` and an `npm start` that compiles only when needed, so the workshop flow does not break. |

Until one of these signals appears, the rule is the same as for the rest of the harness: the minimum that can be read from end to end.

## Checked by

`tests/unit/arquitectura.test.js`: it fails if a module in `app/js/` imports a package instead of a relative path, or if `package.json` declares a runtime dependency other than `ajv`.
