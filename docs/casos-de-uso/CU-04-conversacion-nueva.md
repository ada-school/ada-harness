# CU-04 Start a new conversation

**Actor:** the person using the chat.
**Goal:** start over with an empty context, for example between two exercises in a workshop.
**Preconditions:** the server is running.
**Trigger:** the person presses "New conversation".

## Main flow

1. The chat asks the server to forget the conversations.
2. The page reloads: an empty conversation and the inspector at zero.
3. The next message reaches the model with no earlier turns.

## Acceptance criteria

- **CU-04.1** Given a conversation with history, when the person presses "New conversation", then the server forgets it and the next message reaches the model with no earlier turns.
- **CU-04.2** (manual) Given a conversation with history, when the person presses "New conversation", then the screen returns to the initial state: an empty conversation and the inspector at zero. Verification: run a turn, press the button, and look at both panels.

## Out of scope

- Deleting only one conversation when several tabs are open: the server forgets all of them.
