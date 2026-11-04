# 0008. An agent is a file and an entry in routing.json

**Status:** accepted, October 2026.

## Context

Adding a subagent meant touching three places: its prompt, `routing.json`, and the agent list written by hand inside `src/harness.js`. Forgetting the third left an agent the model could not ask for. Also, every subagent used the fast model, including the one that writes code.

## Decision

- An agent is `harness/agents/<name>.md`, with `name` and `description` frontmatter and the system prompt in the body.
- `routing.json` → `agents.<name>` declares which tools it sees, its iteration cap, and its model: `"fast"` (the default) or `"main"`.
- The `spawn_agent` tool is built each turn from that index: name and description of each declared agent. It is the same pattern as skills: the index is inside, the content is outside.
- Only the main agent spawns subagents. A subagent cannot spawn another.
- The same roles are offered to Claude Code in `.claude/agents/`, as wrappers that read the file in `harness/agents/`. The prompt lives in one place.

| Agent | What it is for | Tools | Model |
|---|---|---|---|
| `researcher` | Explore and summarize | read, list, web | fast |
| `reviewer` | Review one concrete change | read, list, commands | fast |
| `frontend` | Build screens with use cases and tests first | read, list, write, commands, skills | main |
| `qa` | Review the whole project against decisions, use cases, and tests | read, list, commands, skills | main |

## Consequences

- Adding an agent is one file and one entry. No code.
- Each new agent adds its description to the `spawn_agent` definition, which the model reads on every call. That is why descriptions are one line.

## Checked by

`tests/unit/agentes.test.js`: each agent in `routing.json` has its file with `name` and `description`, uses only tools that exist, and appears in `spawn_agent`.

## When to revisit

If an agent needs something that is not a prompt plus tools (for example, another provider or a different loop).
