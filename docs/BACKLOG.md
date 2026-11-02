# Backlog

Revisión de noviembre de 2026. El pedido fue: instalar con npm, usar librerías que ya existan, y correr el chat y la terminal con la misma práctica. Esta lista dice qué entra, qué no, y qué queda para después.

## Decisión de esta revisión

El repo ya es un paquete npm (`package.json`, scripts, TypeScript solo para tipos). Lo que faltaba era un comando único, con ayuda y versión, que abra el chat o corra un turno.

No se agregan dependencias para correr. `npm install` sigue siendo opcional y solo trae el chequeo de tipos. La razón está en la [decisión 0001](decisiones/0001-interfaz-sin-compilacion.md): en el taller, clonar y correr con Node 18 tiene que alcanzar, sin red y sin un lockfile de cientos de paquetes. Una librería que reemplace diez líneas de `node:http` o de `node:util` empeora la instalación, que era el objetivo.

El comando nuevo está en la [decisión 0010](decisiones/0010-comando-unico.md).

## Hecho

- [x] `bin/ada.js`: un solo comando para el chat (`serve`), un turno (`run`) y el peso de las capas (`capas`).
- [x] `--help` y `--version`. Los flags del turno (`--anthropic`, `--gemini`, `--ollama`, `--model`) y los del chat (`--port`, `--host`) salen del mismo lector, `node:util` `parseArgs`.
- [x] `npm start`, `npm run cli` y `npm run capas` llaman a ese comando. `node src/server.js` y `node src/harness.js` siguen funcionando.
- [x] Cero dependencias de runtime. La prueba de la decisión 0001 sigue en pie.

## No entra

| Propuesta | Por qué no |
|---|---|
| Express, Fastify u otro servidor | `src/server.js` ya reparte API y estáticos. Un framework obliga a `npm install` y esconde el recorrido que el taller enseña. |
| Commander, yargs u otro parser | `parseArgs` está en Node 18. Un paquete solo valdría si cada subcomando tuviera su propio juego de opciones. |
| dotenv | `loadEnvFile()` en `src/config.js` cubre el `.env` de este proyecto. |
| Vite, Preact, Tailwind o React en el chat | La señal para reabrir esto ya está en la decisión 0001: varias pantallas, o una interfaz que el modelo genere. Hoy hay una pantalla. |

## Después

Sale de los límites del README. Ninguno está en curso.

- [ ] Respuesta en streaming (SSE) en `/api/chat` y en la terminal.
- [ ] Historial de sesiones en disco. Hoy vive en memoria y se pierde al reiniciar.
- [ ] Conteo de tokens con la API, al lado de la estimación de 4 caracteres.
- [ ] Sandbox de verdad para `run_command`. Hoy hay timeout y carpeta, no un contenedor.
- [ ] Caché de prompt en los proveedores que lo ofrecen. Baja el costo, no el tamaño de la ventana.
- [ ] Publicar el paquete en el registro de npm, cuando el nombre y el versionado estén decididos. Hasta entonces no se documenta `npx` contra el registro: ese comando bajaría otro paquete si el nombre coincidiera.
