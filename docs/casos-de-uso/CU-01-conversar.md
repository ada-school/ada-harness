# CU-01 Talk to the agent

**Actor:** the person using the chat, in a workshop or on their own machine.
**Goal:** ask the agent for something and read its reply.
**Preconditions:** the server is running and at least one model is available (CU-02).
**Trigger:** the person types in the text field.

## Main flow

1. The person writes a message and presses Enter.
2. The chat shows their message and "thinking…", and disables Send.
3. The server runs the whole turn: it can be several calls to the model and several tools.
4. The chat replaces "thinking…" with the reply as the pieces arrive, and updates the inspector when the turn ends (CU-03).
5. Send is available again and the cursor returns to the field.

## Alternate flows

- **2a.** If the field is empty or only spaces, nothing happens.
- **3a.** If the server replies with an error or does not reply, the chat shows the reason and the person can type again.

## Acceptance criteria

- **CU-01.1** Given text in the field, when the person presses Enter, then the message is sent; with Shift+Enter, or while composing text with an input method (IME), Enter adds a line break and does not send.
- **CU-01.2** Given an empty field or one with only spaces, when the person tries to send, then nothing is sent; with text, it is sent without the spaces at the ends.
- **CU-01.3** Given a model reply that contains HTML, when it is shown, then it appears as literal text and is not interpreted.
- **CU-01.4** Given that the server replies with an error or does not reply, when the wait ends, then the conversation shows "error: " and the reason.
- **CU-01.5** Given a second message in the same conversation, when it reaches the model, then it includes the previous turn in full, tools included.
- **CU-01.6** Given a long message, when the person types, then the field grows with the text up to 160 px and then scrolls.
- **CU-01.7** (manual) Given a sent message, while the reply is arriving, then the conversation shows "thinking…" and Send stays disabled. Verification: with Ollama running, send a message and look at the button before the reply.
- **CU-01.8** Given a reply that arrives in pieces, when each piece arrives, then the conversation shows the text so far, HTML included as literal text; when the turn ends, the trace is available and the text already shown stays.
- **CU-01.9** Given a finished turn, when this browser sends the next message to a new server process, then that message uses the same session and the model receives the previous turn.

## Out of scope

- Redrawing old messages on screen after a reload. The model keeps them; the page starts empty.
