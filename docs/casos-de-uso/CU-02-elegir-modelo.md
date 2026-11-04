# CU-02 Choose which model to talk to

**Actor:** the person using the chat.
**Goal:** talk to Claude, Gemini, or a local Ollama model, and know why one of them is unavailable.
**Preconditions:** the server is running.
**Trigger:** the person opens the "Model" selector, or the chat finishes loading.

## Main flow

1. On load, the chat asks the server for the providers and their status.
2. The selector shows Claude and Gemini, and a group with each detected Ollama model.
3. The last model the person used stays selected, if it is still available.
4. The person chooses another model.
5. The chat starts a new conversation, on screen and on the server, and says who they are talking to now.

## Alternate flows

- **2a.** A provider without a key appears disabled and says which variable is missing.
- **2b.** If Ollama does not respond, a disabled option says how to install it and start it.
- **3a.** If no model is available, the conversation explains how to get one.
- **4a.** If the person starts Ollama with the page open, its models appear the next time they open the selector.

## Acceptance criteria

- **CU-02.1** Given Claude or Gemini without its key, when the selector opens, then they appear disabled and say which variable is missing; with a key, they can be chosen and show their model.
- **CU-02.2** Given Ollama with models installed, when the selector opens, then they appear grouped under "Ollama" with its host, each one marked local, cloud, or without tools, and the ones that do not use tools cannot be chosen.
- **CU-02.3** Given that Ollama does not respond, when the selector opens, then a disabled option says how to install it and start it.
- **CU-02.4** Given a model already chosen, or one saved from another visit, when the selector is filled again, then that model stays if it is still available; if not, the one the server marks as default stays, and never a disabled one.
- **CU-02.5** Given a model with ":" in the name (for example qwen3:8b), when a message is sent, then the server receives the provider and the model separated correctly.
- **CU-02.6** Given a conversation in progress, when the person changes model or provider, then a new conversation starts on screen and on the server, and the chat says who they are talking to now.
- **CU-02.7** Given that no model is available, when the chat loads, then the conversation explains how to get one.

## Out of scope

- Choosing a different model for subagents from the screen: that is decided in `routing.json`.
