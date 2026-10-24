# Casos de uso del chat

Qué tiene que lograr una persona en la pantalla, escrito antes del código. Cada criterio tiene un ID (`CU-01.2`) y cada prueba que lo cubre empieza con ese ID. Por eso la trazabilidad se calcula:

```bash
npm run trazabilidad
```

`tests/unit/casos-de-uso.test.js` falla si un criterio automático no tiene prueba, si una prueba nombra un criterio que no existe o si un ID se repite. El proceso completo está en [`harness/skills/frontend-tdd/SKILL.md`](../../harness/skills/frontend-tdd/SKILL.md) y la plantilla en [`plantilla-caso-de-uso.md`](../../harness/skills/frontend-tdd/plantilla-caso-de-uso.md).

| Caso | La persona logra | Pruebas |
|---|---|---|
| [CU-01](CU-01-conversar.md) | Conversar con el agente | `tests/unit/app/conversacion.test.js`, `tests/integration/server.test.js` |
| [CU-02](CU-02-elegir-modelo.md) | Elegir con qué modelo habla | `tests/unit/app/selector.test.js`, `tests/unit/app/conversacion.test.js` |
| [CU-03](CU-03-inspeccionar-contexto.md) | Ver qué entró a la ventana de contexto | `tests/unit/app/inspector.test.js`, `tests/unit/app/format.test.js` |
| [CU-04](CU-04-conversacion-nueva.md) | Empezar una conversación nueva | `tests/integration/server.test.js` |
