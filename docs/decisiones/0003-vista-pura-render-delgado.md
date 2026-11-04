# 0003. In the chat, logic is pure and render does not decide

**Status:** accepted, October 2026.

## Context

The chat started as a single `index.html` with styles, logic, and the DOM mixed together. Testing anything required a browser, and the model's text was inserted with `innerHTML`: a reply with `<img onerror=…>` ran code.

## Decision

Each module in `app/js/` has one job and belongs to one of four layers:

| Layer | What it does | Examples | How it is tested |
|---|---|---|---|
| Pure view | Receives data and returns what to show: texts, lists, flags. No DOM, no `fetch`, no randomness | `inspectorView()`, `buildOptions()`, `debeEnviar()` | In Node, `tests/unit/app/` |
| Render | Puts the view in the DOM with `createElement` and `textContent`. Decides nothing | `renderInspector()`, `renderSelector()` | Through its view |
| API | Talks to the server | `api.js` | Integration tests |
| Startup | Wires events, state, and modules | `main.js` | Not tested: it has no logic |

Rules that follow:

- An `if` that decides something about the product does not go in `main.js` or in a `render*()`: it goes in a pure function with its test.
- Text that comes from the model or the server is always inserted with `textContent`. Never `innerHTML`, `outerHTML`, or `insertAdjacentHTML`.

## Consequences

- The chat logic is tested in milliseconds, with no browser and no dependencies.
- Writing HTML by hand with `createElement` is longer than a template. While the chat is a handful of modules, the cost is low.

## Checked by

`tests/unit/arquitectura.test.js`: it fails if a module with logic has no test file in `tests/unit/app/`, or if any module uses `innerHTML`.

## When to revisit

Together with [0001](0001-interfaz-sin-compilacion.md): if the chat grows to several screens with shared state, a component framework replaces the hand-written render, but the split between pure view and paint stays.
