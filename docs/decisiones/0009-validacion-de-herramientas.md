# 0009. The server validates each tool's arguments

**Status:** accepted, November 2026.

## Context

The model proposes arguments. The provider can also check them, but each API does it differently, and a badly formed `tool_use` still reaches the loop. Without our own check, `write_file` accepted extra properties and a missing `content`.

## Decision

- `src/validation.ts` is a thin wrapper around Ajv 8.17.1. It checks the keywords the tool definitions use: `type`, `properties`, `required`, `additionalProperties: false`, `enum`, `items`, lengths, and ranges. Node runs `dist/src/validation.js`. The sentences are English unless `ADA_LANG=es`, from `src/text.ts`. `ajv` is the only runtime dependency.
- `runTool()` validates against `input_schema` before running. Errors come back to the model as text.
- A malformed schema throws: it fails closed.

## Consequences

- The harness does not depend on Anthropic, Gemini, or Ollama rejecting the input.
- Ajv accepts more of JSON Schema than the old checker. A keyword the tools do not use yet still needs a mapped sentence and a test before a tool schema relies on it.

## Checked by

`tests/unit/validation.test.js` and `tests/unit/harness.test.js`.

## When to revisit

If a tool needs a construct the subset does not cover, or if a provider stops sending objects and another format has to be validated.
