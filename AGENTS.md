# AGENTS.md

This file is concatenated to the system prompt on every call. It is the project guide: what any agent must know before touching code. Keep it short. One rule here is worth more than repeating it in every message.

## About this project

- Name: ADA Harness (template). Replace this section with the name, the stack, and the goal of the software you are building.
- The agent reads, writes, and runs commands only in `ADA_WORKSPACE`. If you do not set it, that folder is `workspace/`. Outside it, the agent only reads.

## Commands

- Chat: `npm start`
- One turn: `npm run cli -- "your message"`
- Tests: (your project's command)

## Working rules

1. Before writing code, read the file you are about to change. Do not rebuild content from memory.
2. Small, checkable changes. One turn, one intention.
3. If a task has more than 3 steps, write the plan in `PLAN.md` inside the working folder and check off each step as you go.
4. Research, review, front end, and QA go to subagents (`spawn_agent`). Do not fill the main context with raw results.
5. If something fails, report the exact error. Do not hide it with a different attempt in silence.
6. Write in clear English. Short sentences.
7. Front end: use case first, then the test, then the code (`frontend-tdd` skill).

## Do not touch

- `harness/system.md` and `harness/routing.json` change only with human approval.
- Never write secrets into memory or into the working folder.
