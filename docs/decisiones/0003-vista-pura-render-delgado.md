# 0003. En el chat, la lógica es pura y el render no decide

**Estado:** aceptada, octubre de 2026.

## Contexto

El chat empezó como un solo `index.html` con estilos, lógica y DOM mezclados. Probar algo exigía un navegador, y el texto del modelo se insertaba con `innerHTML`: una respuesta con `<img onerror=…>` ejecutaba código.

## Decisión

Cada módulo de `app/js/` tiene un solo trabajo y pertenece a una de cuatro capas:

| Capa | Qué hace | Ejemplos | Cómo se prueba |
|---|---|---|---|
| Vista pura | Recibe datos y devuelve qué mostrar: textos, listas, banderas. Sin DOM, sin `fetch`, sin azar | `inspectorView()`, `buildOptions()`, `debeEnviar()` | En Node, `tests/unit/app/` |
| Render | Pone la vista en el DOM con `createElement` y `textContent`. No decide nada | `renderInspector()`, `renderSelector()` | A través de su vista |
| API | Habla con el servidor | `api.js` | Pruebas de integración |
| Arranque | Conecta eventos, estado y módulos | `main.js` | No se prueba: no tiene lógica |

Reglas que salen de aquí:

- Un `if` que decide algo de negocio no va en `main.js` ni en un `render*()`: va en una función pura con su prueba.
- Texto que viene del modelo o del servidor se inserta siempre con `textContent`. Nunca `innerHTML`, `outerHTML` ni `insertAdjacentHTML`.

## Consecuencias

- La lógica del chat se prueba en milisegundos, sin navegador ni dependencias.
- Escribir HTML a mano con `createElement` es más largo que una plantilla. Mientras el chat sea un puñado de módulos, el costo es bajo.

## Se verifica en

`tests/unit/arquitectura.test.js`: falla si un módulo con lógica no tiene su archivo de pruebas en `tests/unit/app/`, o si algún módulo usa `innerHTML`.

## Cuándo revisarla

Junto con la [0001](0001-interfaz-sin-compilacion.md): si el chat crece a varias pantallas con estado compartido, un framework de componentes reemplaza el render a mano, pero la separación entre vista pura y pintura se mantiene.
