# Chat use cases

What a person has to be able to do on the screen, written before the code. Each criterion has an ID (`CU-01.2`) and each test that covers it starts with that ID. That is how traceability is computed:

```bash
npm run trazabilidad
```

`tests/unit/casos-de-uso.test.js` fails if an automatic criterion has no test, if a test names a criterion that does not exist, or if an ID is repeated. The full process is in [`harness/skills/frontend-tdd/SKILL.md`](../../harness/skills/frontend-tdd/SKILL.md) and the template is in [`plantilla-caso-de-uso.md`](../../harness/skills/frontend-tdd/plantilla-caso-de-uso.md).

| Case | The person can | Tests |
|---|---|---|
| [CU-01](CU-01-conversar.md) | Talk to the agent | `tests/unit/app/conversacion.test.js`, `tests/integration/server.test.js` |
| [CU-02](CU-02-elegir-modelo.md) | Choose which model they talk to | `tests/unit/app/selector.test.js`, `tests/unit/app/conversacion.test.js` |
| [CU-03](CU-03-inspeccionar-contexto.md) | See what entered the context window | `tests/unit/app/inspector.test.js`, `tests/unit/app/format.test.js` |
| [CU-04](CU-04-conversacion-nueva.md) | Start a new conversation | `tests/integration/server.test.js` |
