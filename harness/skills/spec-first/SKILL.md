---
name: spec-first
description: Procedure for starting any feature or non-trivial change. Write a short spec before code. Load it when the user asks to build something new.
---
# Spec first

Before writing code for a new feature, create `workspace/specs/<name>.md` with exactly these sections:

1. **Goal** (one sentence): what the user will be able to do that they cannot do today.
2. **Out of scope**: what this iteration will not do.
3. **Interface**: functions, endpoints, or commands you add, with their signatures.
4. **Done when**: how to check it, as commands or tests.
5. **Risks**: what could break.

Then show the spec to the user and wait for confirmation before implementing. If the user already gave every detail and the task is small, write the spec and continue without waiting.
