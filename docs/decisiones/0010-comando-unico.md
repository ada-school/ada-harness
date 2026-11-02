# 0010. Un comando para el chat y para la terminal

**Estado:** aceptada, noviembre de 2026.

## Contexto

Correr el proyecto pedía acordarse de dos archivos: `node src/server.js` para el chat y `node src/harness.js` para un turno. El lector de argumentos era un `filter` sobre `process.argv`, sin `--help` ni `--version`, y un flag desconocido se tomaba como nombre de proveedor.

El pedido de esta revisión era usar npm y librerías existentes para que instalar y correr fuera más fácil. El repo ya es un paquete npm. Las librerías de servidor, de CLI y de interfaz obligan a `npm install` con red, y eso es lo que la [decisión 0001](0001-interfaz-sin-compilacion.md) evita a propósito.

## Decisión

- `bin/ada.js` es el comando. `npm start` abre el chat, `npm run cli` corre un turno y `npm run capas` mide las capas. Los tres llaman a ese archivo.
- `src/cli.js` lee los argumentos con `parseArgs` de `node:util`. Subcomandos: `serve`, `run`, `capas`. Flags: proveedor, `--model`, `--port`, `--host`, `--help`, `--version`.
- `--port` y `--host` pisan a `PORT` y `ADA_HOST` después de cargar `.env`.
- `node src/server.js` y `node src/harness.js` delegan en el mismo lector. Sin argumentos, el primero abre el chat y el segundo corre un turno de ejemplo.
- No hay dependencias para correr. TypeScript sigue solo en `devDependencies`.

## Consecuencias

- Ayuda y errores de argumentos salen en español, y un flag desconocido no llega al proveedor.
- Quien clona el repo sigue sin necesitar `npm install` para ver el chat.
- Un paquete de CLI entra solo si los subcomandos dejan de compartir opciones. Un framework de interfaz entra solo con las señales de la decisión 0001.

## Se verifica en

`tests/unit/http-cli.test.js` y `tests/unit/arquitectura.test.js`.

## Cuándo revisarla

Si el comando se publica en el registro de npm, o si `serve` y `run` necesitan opciones que ya no caben en un solo `parseArgs`.
