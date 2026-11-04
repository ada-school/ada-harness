# 0002. One internal message format and one adapter per provider

**Status:** accepted, October 2026.

## Context

The harness talks to Claude, Gemini, and Ollama. Each API has its own way to represent a tool request and its result: `tool_use` and `tool_result` in Claude, `functionCall` and `functionResponse` in Gemini, the `tool` role in Ollama. If the loop knew those differences, every new provider would touch the heart of the harness.

## Decision

- History is always stored in one format: the block format of the Anthropic API (`text`, `tool_use`, `tool_result`). It is typed in `src/types.ts`.
- Each provider lives in `src/providers/<name>.ts` and meets the `Provider` contract: it translates the history to its API and the response back to the internal format. Node runs the compiled file under `dist/src/providers/`. Claude is `anthropic.ts`. Gemini is `gemini.ts`. Ollama is `ollama.ts`.
- What an adapter needs to remember between calls is stored on the block in a field that starts with `_` (for example `_gemini.thoughtSignature`). No other adapter sends it to its API.
- Changing provider starts a new conversation. One API's signatures and ids are useless in another.

## Consequences

- The loop (`src/harness.ts`; Node runs `dist/src/harness.js`) has no `if` per provider.
- Adding a provider is one file and one line in `src/providers/index.ts`. Node runs `dist/src/providers/index.js`.
- Claude barely translates, and that is a starting advantage for Anthropic that we accept: the format is well documented and covers everything the loop needs.

## Checked by

`tests/providers/`: round-trip translation, tool ids, Gemini signatures that come back intact, and private fields that do not leak to another API.

## When to revisit

If a new API needs something the block format cannot express (for example, audio output or tools that run on the provider's side).
