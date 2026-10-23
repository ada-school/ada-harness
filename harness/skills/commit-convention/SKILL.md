---
name: commit-convention
description: Cómo escribir mensajes de commit y agrupar cambios en este repo. Cárgalo antes de proponer o hacer un commit.
---
# Convención de commits

Formato: `tipo(alcance): resumen en imperativo, máximo 72 caracteres`

Tipos: feat, fix, docs, refactor, test, chore.

Reglas:
1. Un commit, una intención. Si el diff mezcla dos cosas, sepáralo.
2. El cuerpo explica el porqué, no el qué (el diff ya muestra el qué).
3. Nunca commitees `.env`, credenciales ni archivos de `workspace/`.

Ejemplo:
```
feat(harness): compactar historial al 80% del presupuesto

Antes el loop esperaba a que la API rechazara la llamada. Ahora resume
los mensajes viejos cuando el estimado supera el umbral de routing.json.
```
