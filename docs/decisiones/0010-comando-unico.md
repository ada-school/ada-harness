# 0010. One command for the chat and the terminal

**Status:** accepted, November 2026.

## Context

Running the project meant remembering two files: `node src/server.js` for the chat and `node src/harness.js` for one turn. The argument reader was a `filter` over `process.argv`, with no `--help` and no `--version`, and an unknown flag was taken as a provider name.

This review asked to use npm and existing libraries so install and run would be easier. The repo is already an npm package. Server, CLI, and UI libraries force `npm install` with a network, and that is what [decision 0001](0001-interfaz-sin-compilacion.md) avoids on purpose.

## Decision

- `bin/ada.js` is the command. `npm start` opens the chat, `npm run cli` runs one turn, and `npm run capas` measures the layers. All three call that file.
- `src/cli.ts` reads the arguments with `parseArgs` from `node:util`. Node runs `dist/src/cli.js`. Subcommands: `serve`, `run`, `capas`. Flags: provider, `--model`, `--port`, `--host`, `--help`, `--version`. The help text stays Spanish, including `ayuda`. The documented way to open the chat is `npm start`.
- `--port` and `--host` override `PORT` and `ADA_HOST` after `.env` is loaded.
- The compiled server and the compiled loop delegate to the same reader. The documented command is `npm start` for the chat and `npm run cli` for one turn. The server source is `src/server.ts` and the loop source is `src/harness.ts`. Node runs the files under `dist/`.
- The only runtime dependency is `ajv`. TypeScript stays in `devDependencies`. `npm install` is required because `npm start` compiles the engine.

## Consequences

- Help text and argument errors are still in Spanish, and an unknown flag never reaches the provider.
- Someone who clones the repo runs `npm install`, then `npm start`, to see the chat.
- A CLI package comes in only if the subcommands stop sharing options. A UI framework comes in only with the signals in decision 0001.

## Checked by

`tests/unit/http-cli.test.js` and `tests/unit/arquitectura.test.js`.

## When to revisit

If the command is published to the npm registry, or if `serve` and `run` need options that no longer fit in one `parseArgs`.
