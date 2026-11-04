---
name: frontend-tdd
description: Process for creating or changing a screen. Use case, tests first, and no build step. Load it before touching the front end.
---
# Front end with use cases and tests first

This applies to every change a person would notice on screen, bugs included: a bug is a criterion that is not met.

Before you start, read the architecture rules: `/harness/skills/frontend-tdd/arquitectura.md`. The reason for each rule is in `/docs/decisiones/`.

Paths in this repo: use cases in `docs/casos-de-uso/`, code in `app/js/`, tests in `tests/unit/app/`. In another project, use the paths its AGENTS.md names.

## 1. Use case

1. Look in `docs/casos-de-uso/` for a case that covers the change. If one exists, add criteria with the next free number. If not, create `CU-NN-name.md` from `/harness/skills/frontend-tdd/plantilla-caso-de-uso.md`.
2. Write each criterion on one line, with its ID in bold and the shape "Given..., when..., then...": `- **CU-05.1** Given ..., when ..., then ...`
3. A criterion describes something the person observes, not how it is implemented. "The button stays disabled while it waits" yes. "setDisabled is called" no.
4. If a criterion cannot be automated (how something looks), mark it `(manual)` and write how to check it.
5. If the task is ambiguous, stop and return the questions. An invented criterion is worse than a question.
6. A criterion that no longer applies is deleted together with its tests. Its number is not reused.

## 2. Red: the test first

One criterion at a time, in order:

1. Decide which pure function decides it (arquitectura.md, section 2). If it does not exist yet, the test imports it anyway: the red will be "does not exist".
2. Write the test in `tests/unit/app/<module>.test.js`. The name starts with the ID: `test("CU-05.1 an empty message is not sent", ...)`.
3. Run it alone: `node --test tests/unit/app/<module>.test.js`.
4. Confirm that it fails, and that it fails for the expected reason, not because of a syntax error or a bad import. Read the message.
5. If the behavior already existed (a characterization test), it will pass on the first run. Break the code on purpose, confirm the test catches it, and put the code back.

## 3. Green: the minimum code

1. Write only what that test needs in order to pass. Nothing for future criteria.
2. The decision goes in the pure function. `render*()` only paints. `main.js` only wires things together.
3. Run the test file again. If another test turned red, fix it before continuing.

## 4. Cleanup, with everything green

1. Improve names, remove duplication, and complete the JSDoc of what you export. Tests do not change in this step.
2. Run `npm run check` (types, every test, architecture, and traceability). If something fails, go back: never continue on red.
3. Return to step 2 with the next criterion.

## 5. Integration and the screen

1. If the criterion crosses the server (sessions, providers, routes), add or adjust a test in `tests/integration/` with the ID in the name.
2. Open the chat (`npm start`) and walk the main flow and the alternate flows of the case. `(manual)` criteria are checked here.
3. Run `npm run trazabilidad` and confirm that every criterion of the case has its test.

## 6. Done when

- Every criterion of the case has a test that names its ID, or is marked `(manual)` with how to check it.
- `npm run check` passes.
- The use case describes what was built. If the scope changed along the way, the case changed first.
- If the file structure changed, the README and CLAUDE.md say so.
- The `qa` agent reviewed it and left no blockers.

## Mistakes this process avoids

- Writing the render first and testing by hand.
- One test per function instead of one per criterion.
- A test that repeats the implementation's calculation: if both have the same bug, the test passes.
- Several criteria in one test: when it fails, you do not know which one broke.
- Deleting or weakening a test so it passes.

## What to deliver

A short report: the use case and the criteria covered (ID and test), files changed, a short summary of `npm run check`, and what is still pending or manual.
