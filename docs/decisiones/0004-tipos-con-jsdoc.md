# 0004. Types in JSDoc, checked by TypeScript, with no compile step

**Status:** replaced for the engine by [0011](0011-ingles-typescript-y-librerias.md), November 2026. The chat still uses JSDoc. The architecture test still requires a JSDoc block on every export, and it reads the TypeScript sources.

## Context

We wanted the editor to autocomplete and a wrong name (`trace.call` instead of `trace.calls`) to be caught before a run. Writing the project in TypeScript forces a compile. At the time, that broke a freshly cloned `node src/server.js` (see [0001](0001-interfaz-sin-compilacion.md)). The engine now compiles to `dist/`.

## Decision

- Shared types live in `src/types.ts` as exported types. `Provider` is an interface. The file exports no value, and nothing imports one from it. JSDoc still writes `import("./types.js")`. TypeScript resolves that to `types.ts`.
- The engine sources are TypeScript. `npm run build` (`tsconfig.build.json`) writes `dist/`, and Node runs those files. `bin/ada.js` imports them. Exports stay the same, including `abiertoALaRed` and `sinFrontmatter`. Printed strings in the validator, the window, the context indexes, the provider adapters, the chat API, and the server startup stay Spanish until the error-message phase in the backlog. Tool descriptions stay Spanish too: they travel on every call. The spawn_agent description in the loop stays Spanish for the same reason.
- `app/`, the tests, and `bin/ada.js` stay JavaScript. The main `tsconfig.json` does not emit, and `noImplicitAny` stays off there because `app/` and the tests are still JavaScript. The engine build turns `noImplicitAny` on. `npm run typecheck` runs both.
- Two concessions remain for `app/` and the tests: unannotated parameters stay `any`, and inside a `catch` you may read `e.message` without a prior check.
- A new provider is annotated with `@satisfies {Provider}`: if a method is missing, the check fails.
- TypeScript is a development dependency. `npm install` is required to compile the engine. The only runtime dependency is `ajv`.

## Consequences

- The chat still loads without its own compile. The engine compiles to `dist/` on `npm start`.
- JSDoc is more verbose than TypeScript for complex types.

## Checked by

`npm run typecheck` and the CI workflow (`.github/workflows/ci.yml`).

## When to revisit

The engine compile has landed. The JSDoc rule remains for the chat, and for every export the architecture test still scans.
