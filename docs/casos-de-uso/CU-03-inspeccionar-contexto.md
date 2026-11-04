# CU-03 See what entered the context window

**Actor:** someone learning how an agent works, in a workshop or on their own.
**Goal:** see, after each turn, which layers entered the last call, how much each one weighed, and what the loop did.
**Preconditions:** there has been at least one turn (CU-01).
**Trigger:** a turn's reply arrives.

## Main flow

1. The inspector shows the provider, the model, and the size of the real window.
2. The meter paints each layer in its color, in proportion to the window.
3. The layer list says how many estimated tokens each one weighed. The line under the meter says that estimate and, beside it, the input and output counts the API reported.
4. The counters say the calls in the turn, the tools used, and the real input tokens.
5. The events list tools, compactions, warnings, and subagents.

## Alternate flows

- **1a.** If the turn does not report a window, the inspector uses the last known one.
- **5a.** If the turn used no tools and had no events, the inspector says so.
- **5b.** If the turn ended in an error, the inspector does not change.

## Acceptance criteria

- **CU-03.1** Given a turn, when the reply arrives, then the inspector says the provider, the model, and the size of the real window.
- **CU-03.2** Given a turn, when the reply arrives, then the meter takes the model's real window as 100% and says how many estimated tokens the last call used and what percentage that is.
- **CU-03.3** Given a turn whose trace does not report a window, when the inspector updates, then it uses the last known window.
- **CU-03.4** Given any layer, when it is painted, then it uses the same color as in the explainer; an unknown layer uses a neutral gray.
- **CU-03.5** Given a turn, when the reply arrives, then the counters show the calls in the turn, the tools used, and the real input tokens the API reported.
- **CU-03.6** Given a turn with tools, compactions, warnings, or subagents, when the events are listed, then each one appears as plain text, even if the model put HTML in a tool's input.
- **CU-03.7** Given a turn with no tools and no events, when the inspector updates, then the events say "No tools in this turn.".
- **CU-03.8** Given a turn that ended in an error, when the reply arrives, then the inspector keeps the last call that did complete.
- **CU-03.9** Given a turn whose API reported token counts, when the inspector updates, then those counts appear beside the 4-character estimate, and the output count appears when the API sent it.

## Out of scope

- Seeing the full text of each layer: that is what the explainer is for.
- History of earlier turns in the inspector: it shows only the last call.
