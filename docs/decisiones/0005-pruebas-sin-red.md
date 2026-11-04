# 0005. Tests in three layers, with no keys and no network

**Status:** accepted, October 2026.

## Context

The harness talks to three APIs and runs tools on disk. A test that calls a real API costs money, fails when the network fails, and does not run in CI without secrets. A test that writes in `workspace/` leaves junk.

## Decision

Three layers, each in its own folder, and `node tests/run.js <layer>` to run one:

| Layer | What it tests | With what |
|---|---|---|
| `tests/unit/` | Pure functions: tools, context, window, chat, HTTP, terminal, architecture, traceability | Nothing external |
| `tests/providers/` | Each adapter's translation | `fakeFetch` for Claude and Gemini, a fake HTTP server that imitates Ollama |
| `tests/integration/` | The real server from end to end | Server on a free port, fake Ollama |

- No test uses a real key or goes out to the internet.
- Each test that touches disk works in a temporary workspace (`ADA_WORKSPACE`) and a temporary memory (`ADA_MEMORY`). See `tests/helpers/workspace.js`. Running the tests leaves no trace in the repo.
- The simulations follow each API's documented format, not what we wish it returned.
- Only `node:test` and `node:assert`. No test frameworks.

## Consequences

- `npm test` runs in seconds, on any machine and in CI.
- If an API changes its format, the tests stay green. Before a workshop, run one real turn with your key.

## Checked by

`tests/run.js` and CI, which runs with no secrets on Node 18, 20, and 22.

## When to revisit

If a bug appears that only a real call would have caught. The answer would be an optional fourth layer (`tests/live/`), which runs only when a key is present and never in CI.
