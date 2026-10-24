---
name: frontend-tdd
description: Proceso para crear o cambiar una pantalla: caso de uso, pruebas primero y arquitectura sin compilación. Cárgalo antes de tocar el front end.
---
# Front end con casos de uso y pruebas primero

Aplica a todo cambio que una persona note en pantalla, bugs incluidos: un bug es un criterio que no se cumple.

Antes de empezar, lee las reglas de arquitectura: `/harness/skills/frontend-tdd/arquitectura.md`. El porqué de cada regla está en `/docs/decisiones/`.

Rutas de este repo: casos de uso en `docs/casos-de-uso/`, código en `app/js/`, pruebas en `tests/unit/app/`. En otro proyecto, usa las rutas que diga su AGENTS.md.

## 1. Caso de uso

1. Busca en `docs/casos-de-uso/` un caso que cubra el cambio. Si existe, agrega criterios con el siguiente número libre. Si no, crea `CU-NN-nombre.md` desde `/harness/skills/frontend-tdd/plantilla-caso-de-uso.md`.
2. Escribe cada criterio en una línea, con su ID en negrita y la forma "Dado..., cuando..., entonces...": `- **CU-05.1** Dado ..., cuando ..., entonces ...`
3. Un criterio describe algo que la persona observa, no cómo se implementa. "El botón queda deshabilitado mientras espera" sí; "se llama a setDisabled" no.
4. Si un criterio no se puede automatizar (cómo se ve algo), márcalo `(manual)` y escribe cómo verificarlo.
5. Si la tarea es ambigua, detente y devuelve las preguntas. Un criterio inventado es peor que una pregunta.
6. Un criterio que deja de aplicar se borra junto con sus pruebas. Su número no se reutiliza.

## 2. Rojo: la prueba primero

Un criterio a la vez, en orden:

1. Decide qué función pura lo decide (arquitectura.md, sección 2). Si todavía no existe, la prueba la importa igual: el rojo será "no existe".
2. Escribe la prueba en `tests/unit/app/<modulo>.test.js`. El nombre empieza con el ID: `test("CU-05.1 un mensaje vacío no se envía", ...)`.
3. Córrela sola: `node --test tests/unit/app/<modulo>.test.js`.
4. Confirma que falla y que falla por la razón esperada, no por un error de sintaxis o un import mal escrito. Lee el mensaje.
5. Si el comportamiento ya existía (prueba de caracterización), pasará de entrada. Rompe el código a propósito, confirma que la prueba lo detecta y deja el código como estaba.

## 3. Verde: el mínimo código

1. Escribe solo lo necesario para que esa prueba pase. Nada para criterios futuros.
2. La decisión va en la función pura. El `render*()` solo pinta. `main.js` solo conecta.
3. Corre de nuevo el archivo de pruebas. Si otra prueba se puso roja, arréglalo antes de seguir.

## 4. Limpieza con todo en verde

1. Mejora nombres, quita duplicación, completa el JSDoc de lo que exportas. Las pruebas no cambian en este paso.
2. Corre `npm run check` (tipos, todas las pruebas, arquitectura y trazabilidad). Si algo falla, vuelve atrás: nunca avances sobre rojo.
3. Vuelve al paso 2 con el siguiente criterio.

## 5. Integración y pantalla

1. Si el criterio cruza el servidor (sesiones, proveedores, rutas), agrega o ajusta una prueba en `tests/integration/` con el ID en el nombre.
2. Abre el chat (`npm start`) y recorre el flujo principal y los alternos del caso. Los criterios `(manual)` se verifican aquí.
3. Corre `npm run trazabilidad` y confirma que cada criterio del caso tiene su prueba.

## 6. Listo cuando

- Cada criterio del caso tiene una prueba que nombra su ID, o está marcado `(manual)` con su verificación.
- `npm run check` pasa.
- El caso de uso describe lo que se construyó. Si el alcance cambió en el camino, el caso cambió primero.
- Si cambió la estructura de archivos, el README y CLAUDE.md lo dicen.
- El agente `qa` revisó y no dejó bloqueantes.

## Errores que este proceso evita

- Escribir primero el render y probar a mano.
- Una prueba por función en vez de una por criterio.
- Una prueba que repite el cálculo de la implementación: si los dos tienen el mismo error, la prueba pasa.
- Varios criterios en una sola prueba: cuando falla, no sabes cuál se rompió.
- Borrar o debilitar una prueba para que pase.

## Qué entregar

Un informe corto: caso de uso y criterios cubiertos (ID y prueba), archivos cambiados, salida resumida de `npm run check` y lo que quedó pendiente o manual.
