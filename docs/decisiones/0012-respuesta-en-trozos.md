# 0012. A turn can arrive in pieces, and JSON stays the default

**Status:** accepted, November 2026.

## Context

`POST /api/chat` waited for the whole turn and returned one JSON object. A long reply, or a turn that calls tools, left the chat on "thinking…" until the end. The terminal did the same: it printed the reply only after the turn finished.

## Decision

- A client that sends `Accept: text/event-stream` gets Server-Sent Events. `delta` carries a piece of text. `done` carries `{text, trace, reset}`, the same object as before. `error` carries `{error}` once the stream has started. A bad request, a refused host, and a missing message still answer with JSON, before any event.
- A client that does not ask for the stream, including the tests and `curl`, still gets that JSON object.
- The loop takes an optional `onText`. Ollama calls it while it reads the NDJSON stream, and still returns one internal response. Claude and Gemini do not stream yet: the loop forwards their finished text as one piece. The loop has no branch per provider.
- The terminal writes each piece as it arrives. The chat shows the text so far and keeps it when `done` arrives. The inspector updates from `done`.

## Consequences

- Session history is still the full turn, not the pieces. It still lives in memory.
- Adding token streaming for Claude or Gemini is a change inside that provider's `call`, using the same `onText`. It does not change the chat or the route.

## Checked by

`tests/unit/app/conversacion.test.js` (CU-01.8) reads the pieces. `tests/integration/server.test.js` walks the stream against fake Ollama and checks that the next turn still has the text. `tests/providers/ollama.test.js` checks the pieces and a tool call. `tests/unit/http-cli.test.js` checks the terminal.

## When to revisit

When Claude or Gemini should send tokens as they arrive, or when a piece is something other than text (a tool starting, for example).
