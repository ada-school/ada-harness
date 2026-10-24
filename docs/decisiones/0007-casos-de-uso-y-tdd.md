# 0007. El front end se construye con casos de uso y pruebas primero

**Estado:** aceptada, octubre de 2026.

## Contexto

Con la [0003](0003-vista-pura-render-delgado.md), la lógica del chat se puede probar en Node. Falta decidir qué se prueba y en qué orden. Sin eso, las pruebas terminan describiendo la implementación ("buildOptions devuelve dos grupos") en vez de lo que la persona necesita, y nadie sabe si una pantalla está completa.

## Decisión

- Todo cambio que una persona note en pantalla parte de un caso de uso en `docs/casos-de-uso/`, con criterios de aceptación numerados (`CU-01.2`).
- Cada criterio se implementa en ciclo de pruebas primero: una prueba que falla por la razón esperada, el código mínimo que la hace pasar, y limpieza con todo en verde.
- El nombre de cada prueba empieza con el ID del criterio que cubre. Así la trazabilidad se calcula, no se mantiene a mano.
- Un criterio que no se puede automatizar (por ejemplo, cómo se ve algo) se marca `(manual)` y dice cómo verificarlo.
- Un bug es un criterio que no se cumple: primero la prueba que lo reproduce.
- Al terminar, el agente `qa` revisa el proyecto contra las decisiones y los casos de uso.

El procedimiento completo está en `harness/skills/frontend-tdd/SKILL.md`.

## Consecuencias

- `npm run trazabilidad` muestra qué criterio cubre cada prueba y cuáles faltan.
- Escribir el caso de uso antes toma minutos y evita construir lo que nadie pidió.
- Las pruebas de comportamiento que ya existía pasan de entrada. Para confiar en ellas hay que romper el código a propósito y ver que fallan.

## Se verifica en

`tests/unit/casos-de-uso.test.js`: falla si un criterio automático no tiene prueba, si una prueba nombra un criterio que no existe o si un ID se repite.

## Cuándo revisarla

Si los casos de uso dejan de ser la forma en que el equipo piensa las pantallas (por ejemplo, un sistema de diseño con historias por componente). La trazabilidad por ID se mantiene igual.
