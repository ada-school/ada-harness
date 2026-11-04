---
name: commit-convention
description: How to write commit messages and group changes in this repo. Load it before proposing or making a commit.
---
# Commit convention

Format: `type(scope): summary in the imperative, 72 characters at most`

Types: feat, fix, docs, refactor, test, chore.

Rules:
1. One commit, one intention. If the diff mixes two things, split it.
2. The body explains why, not what (the diff already shows what).
3. Never commit `.env`, credentials, or files from `workspace/`.

Example:
```
feat(harness): compact history at 80% of the budget

The loop used to wait until the API rejected the call. It now summarizes
old messages when the estimate passes the threshold in routing.json.
```
