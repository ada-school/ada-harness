# Workshop: open an agent from the inside

Material for the 45-minute in-person workshop on ADA Harness. Everything you need is in this folder.

## Before you start

```bash
git clone https://github.com/ada-school/ada-harness.git
cd ada-harness
cp .env.example .env                      # paste your Claude or Gemini key
cp docs/taller/descuentos.js workspace/
npm install
npm start                                 # opens http://localhost:3000
```

On Windows, PowerShell accepts the same commands. Always open the chat at `http://localhost:3000`, never by double-clicking the HTML.

A Claude key (`ANTHROPIC_API_KEY`) or a Gemini key (`GEMINI_API_KEY`) is enough. The chat's "Model" selector shows the ones you have.

**No key:** install [Ollama](https://ollama.com/download) and download a model **before the workshop** (about 5 GB; the room's wifi cannot carry everyone downloading at once):

```bash
ollama pull qwen3:8b
```

With Ollama running, the harness finds it on its own and the model appears in the selector as "local, free". Without Node 18 and without any of these options: pair up with someone who has them.

## What is here

| File | What it is for |
|---|---|
| `descuentos.js` | The code we use in the demo and the exercise. Copy it to `workspace/`. |
| `plantilla-SKILL.md` | The template for your first skill. |
| `documentar-funcion/SKILL.md` | The worked example. |

## The exercise in four steps

1. Create your skill from the template:

   ```bash
   mkdir harness/skills/your-skill
   cp docs/taller/plantilla-SKILL.md harness/skills/your-skill/SKILL.md
   ```

2. Edit the file. `name` must match the folder name, and `description` is one line, written as a trigger: "Load it when they ask for…".
3. In the chat, ask for something that uses the words in your `description`. You do not need to restart the server: the skills index is reread on every turn.
4. Look for the evidence in the inspector: `load_skill` under **Loop events**, and a taller `skillsIndex` under **Layers**.

To try the worked example: `cp -r docs/taller/documentar-funcion harness/skills/` and ask "Document descuentos.js".

## If you get stuck

| Symptom | Way out |
|---|---|
| `load_skill` does not appear | The `description` is vague. Write it as "Load it when they ask for X" and use the word X in your request. |
| `load_skill` returns an error | `name` does not match the folder, or the file is not named `SKILL.md`. |
| The key is missing (`ANTHROPIC_API_KEY` or `GEMINI_API_KEY`) | Copy `.env.example` to `.env`, paste the key, and restart the server. Or use Ollama, with no key. |
| The startup line says "Ollama: no detectado" | Open the Ollama app or run `ollama serve`, then open the "Model" selector again. That startup line is still Spanish. |
| With Ollama, the agent does not load your skill | Local models are more literal: use the same words as the `description` in your request. |
| "Failed to fetch" in the chat | You opened the HTML with a double click. Go in through `http://localhost:3000`. |

## For later

Open `docs/Anatomía de un Agente.html`, layer 5: fill the context window and try truncate, compact, and offload to files.
