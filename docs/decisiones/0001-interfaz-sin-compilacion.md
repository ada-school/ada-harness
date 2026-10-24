# 0001. El chat sigue sin paso de compilación

**Estado:** aceptada, octubre de 2026.

## Contexto

Llegó una propuesta para reescribir la interfaz con Preact, Tailwind v4, Vite y TypeScript, alrededor de un motor que pinta componentes a partir de un manifiesto JSON (`ComponentNode` → `RenderEngine`). El objetivo declarado era una estructura mejor, más legible, fácil de mantener y con una capa de pruebas.

El objetivo es correcto. Antes de este cambio el chat era un solo `index.html` con estilos, lógica y DOM mezclados, y no había pruebas fuera de los adaptadores de modelos.

## Decisión

Tomamos los objetivos de la propuesta y no sus herramientas. El chat sigue siendo HTML, un CSS y módulos ES nativos que el navegador carga tal cual.

Lo que sí cambió:

| Objetivo de la propuesta | Cómo quedó resuelto |
|---|---|
| Tipos | JSDoc revisado por TypeScript en modo estricto ([0004](0004-tipos-con-jsdoc.md)). El código sigue siendo JavaScript y corre sin compilar. |
| Componentes | `app/js/`: módulos chicos, cada uno con un trabajo. La lógica es pura y el render no decide ([0003](0003-vista-pura-render-delgado.md)). |
| Tokens de diseño | Variables CSS en `app/styles.css`, con los mismos colores por capa que el explicador. |
| Pruebas | Tres capas (unit, providers, integration) y CI en Node 18, 20 y 22. La lógica del chat se prueba en Node, sin navegador ([0005](0005-pruebas-sin-red.md)). |
| Estructura del servidor | `src/` separado por trabajo: `config`, `window`, `cli`, `http/static`, `http/api`. |

## Por qué no las herramientas

1. **El taller depende de clonar y correr.** Hoy basta `git clone` y `node src/server.js`, con Node 18 o superior y sin internet después del clon. Vite 8 pide Node 20.19 o 22.12 en adelante, y el conjunto propuesto suma unos 150 paquetes en el lockfile, varios con binarios nativos por plataforma. En una sala con Wi-Fi compartido y portátiles con Windows, eso es lo que se rompe primero.
2. **El framework sería más grande que la app.** El chat eran unas 300 líneas de JavaScript cuando se tomó esta decisión. Con este tamaño, un framework agrega más superficie para entender que la que ahorra.
3. **El manifiesto resuelve otro problema.** Un motor que pinta pantallas desde JSON sirve cuando las pantallas son datos: muchas variantes configurables, o una interfaz que el agente genera. El chat es una sola pantalla fija. Poner una capa de interpretación entre el código y lo que se ve contradice el principio del proyecto: todo es texto que puedes leer y seguir.
4. **El motor propuesto tenía huecos.** Props como `Record<string, any>` (los tipos se pierden justo en el borde), llaves por índice en las listas, ningún esquema que valide el manifiesto antes de pintarlo, ningún modelo de estado ni de eventos, y ninguna prueba. Si el manifiesto llegara algún día desde la salida de un modelo, la falta de validación sería una superficie de inyección.
5. **La paleta.** La propuesta usaba un azul genérico. En el harness, el color de cada capa es el mismo en el explicador y en el inspector, y esa coincidencia es parte de lo que enseña.

## Cuándo revisar esta decisión

| Señal | Qué haríamos |
|---|---|
| El chat pasa a varias pantallas (sesiones guardadas, editor de skills, panel de memoria) o el estado compartido entre módulos empieza a duplicarse | Preact con `htm`, copiado en `app/vendor/` como un archivo. Componentes con estado, sin build y sin `npm install`. |
| El agente necesita devolver interfaz (formularios, tablas, tarjetas) | Un manifiesto, esta vez con esquema validado, lista cerrada de componentes y pruebas de que un manifiesto malicioso no ejecuta nada. |
| El equipo que mantiene el repo ya trabaja en TypeScript y la interfaz creció | Vite y TypeScript para `app/`, con el servidor sirviendo `app/dist/` y un `npm start` que compile solo cuando haga falta, para no romper el flujo del taller. |

Mientras ninguna de estas señales aparezca, la regla es la misma que para el resto del harness: lo mínimo que se pueda leer de punta a punta.

## Se verifica en

`tests/unit/arquitectura.test.js`: falla si un módulo de `app/js/` importa un paquete en vez de una ruta relativa, o si `package.json` declara dependencias para correr.
