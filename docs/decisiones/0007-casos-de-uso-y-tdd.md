# 0007. The front end is built with use cases and tests first

**Status:** accepted, October 2026.

## Context

With [0003](0003-vista-pura-render-delgado.md), the chat logic can be tested in Node. What was missing was what to test, and in what order. Without that, tests end up describing the implementation ("buildOptions returns two groups") instead of what the person needs, and nobody knows whether a screen is complete.

## Decision

- Every change a person would notice on screen starts from a use case in `docs/casos-de-uso/`, with numbered acceptance criteria (`CU-01.2`).
- Each criterion is implemented in a tests-first cycle: a test that fails for the expected reason, the minimum code that makes it pass, and cleanup with everything green.
- Each test's name starts with the ID of the criterion it covers. Traceability is computed, not kept by hand.
- A criterion that cannot be automated (for example, how something looks) is marked `(manual)` and says how to check it.
- A bug is a criterion that is not met: first the test that reproduces it.
- At the end, the `qa` agent reviews the project against the decisions and the use cases.

The full procedure is in `harness/skills/frontend-tdd/SKILL.md`.

## Consequences

- `npm run trazabilidad` shows which criterion each test covers and which ones are missing.
- Writing the use case first takes minutes and avoids building what nobody asked for.
- Tests of behavior that already existed pass on the first run. To trust them, break the code on purpose and see that they fail.

## Checked by

`tests/unit/casos-de-uso.test.js`: it fails if an automatic criterion has no test, if a test names a criterion that does not exist, or if an ID is repeated.

## When to revisit

If use cases stop being the way the team thinks about screens (for example, a design system with one story per component). Traceability by ID stays the same.
