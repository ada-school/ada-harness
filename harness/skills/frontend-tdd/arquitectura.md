# Arquitectura del front end

Las reglas que salen de las decisiones de `docs/decisiones/`. Si una regla te estorba, no la rompas en silencio: propone una decisión nueva.

## 1. Sin compilación ([0001](../../../docs/decisiones/0001-interfaz-sin-compilacion.md))

- `app/` es HTML, un CSS y módulos ES nativos. El navegador los carga tal cual y el servidor los sirve sin transformar.
- Los imports de `app/js/` son rutas relativas (`./format.js`). Nunca un paquete de npm.
- Sin framework, sin Tailwind, sin bundler, sin `dependencies` en `package.json`. La tabla "Cuándo revisar" de la 0001 dice qué señales cambiarían esto.

## 2. Cuatro capas: la lógica es pura, el render no decide ([0003](../../../docs/decisiones/0003-vista-pura-render-delgado.md))

| Capa | Qué hace | Regla | Se prueba |
|---|---|---|---|
| Vista pura | Datos de entrada → qué mostrar | Sin DOM, sin `fetch`, sin `Date.now()` ni azar. Recibe todo por parámetro | Sí: `tests/unit/app/<modulo>.test.js` |
| Render | Vista → DOM | Solo `createElement`, `textContent`, `replaceChildren`. Ningún `if` de negocio | A través de su vista |
| API | `fetch` al servidor | Una función por ruta, en `api.js` | `tests/integration/` |
| Arranque | Eventos, estado, conexión | Solo `main.js`. Si aparece un `if` que decide algo, sácalo a una vista | No tiene lógica que probar |

Prueba rápida: ¿puedes escribir la prueba sin un navegador? Si no, la lógica está en el lugar equivocado.

## 3. Texto siempre como texto

- Todo texto que viene del modelo, del servidor o de la persona se inserta con `textContent`.
- Prohibidos `innerHTML`, `outerHTML` e `insertAdjacentHTML`, también para "HTML de confianza". Una prueba lo vigila.
- Valores calculados de estilo, solo con variables CSS: `i.style.background = "var(--l-sys)"`.

## 4. Estilos

- Un solo `app/styles.css`. Los colores son variables en `:root`.
- Cada capa de contexto usa el mismo color que en el explicador (`--l-sys`, `--l-route`, `--l-skill`, `--l-mem`, `--l-tools`, `--l-user`, `--l-res`). El mapa está en `format.js` → `colorDeCapa()`.
- Clases cortas y con significado (`.msg`, `.layer`, `.stat`). Sin estilos en línea salvo valores calculados.

## 5. Tipos ([0004](../../../docs/decisiones/0004-tipos-con-jsdoc.md))

- Toda función exportada lleva su bloque JSDoc, con `@param` en cada parámetro y `@returns` cuando el tipo no se infiere del cuerpo. `npm run typecheck` tiene que pasar y `arquitectura.test.js` vigila que el bloque exista.
- Los elementos del DOM se castean una vez, al obtenerlos: `/** @type {HTMLSelectElement} */ ($("prov"))`.

## 6. Estado

- El estado de la pantalla (proveedores cargados, último presupuesto) vive en variables de `main.js`.
- Los módulos de vista no guardan estado entre llamadas.
- `localStorage` solo para comodidades de una persona (el último modelo elegido), siempre dentro de `try/catch`.

## 7. Pruebas ([0005](../../../docs/decisiones/0005-pruebas-sin-red.md), [0007](../../../docs/decisiones/0007-casos-de-uso-y-tdd.md))

- Un archivo por módulo: `app/js/selector.js` → `tests/unit/app/selector.test.js`.
- Una prueba por criterio, con el ID al inicio del nombre.
- Datos realistas: copia la forma de una respuesta verdadera de `/api/providers` o de `/api/chat`.
- `tests/unit/arquitectura.test.js` falla si un módulo con lógica no tiene su archivo de pruebas, si alguien usa `innerHTML` o si `app/js/` importa un paquete.

## 8. Dónde va cada cosa hoy

| Archivo | Capa | Trabajo |
|---|---|---|
| `app/index.html` | estructura | Solo marcado. El orden del panel lateral es el que numeran las slides del taller |
| `app/styles.css` | estilos | Variables de color y diseño |
| `app/js/main.js` | arranque | Conecta eventos, estado y módulos |
| `app/js/api.js` | API | `getProviders`, `sendMessage`, `resetSessions` |
| `app/js/conversacion.js` | vista pura | Cuándo enviar, qué texto enviar, qué líneas agregar con cada respuesta |
| `app/js/selector.js` | vista pura + render | Opciones del selector de modelo y cuál queda elegida |
| `app/js/inspector.js` | vista pura + render | Qué muestra el inspector de un turno |
| `app/js/format.js` | vista pura | Números y color de cada capa |
| `app/js/chat.js` | render | Agrega y limpia mensajes |

Un módulo nuevo entra en esta tabla, en la estructura del README y en la de CLAUDE.md.
