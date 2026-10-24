# 0006. Las herramientas no salen del workspace ni tocan secretos

**Estado:** aceptada, octubre de 2026.

## Contexto

El modelo propone rutas y el harness las ejecuta. Una revisión encontró tres formas de escapar: una carpeta vecina con el mismo prefijo (`workspace-otro`), leer `/.env` desde la raíz del repo y `write_memory` con `../`. Además, todo lo que el agente lee viaja al proveedor del modelo: leer un `.env` es enviarlo.

## Decisión

- `inside(base, ruta)` compara carpetas con `path.relative`, no prefijos de texto. Rechaza `..`, rutas absolutas y carpetas vecinas.
- Rutas que empiezan con `/` se leen desde la raíz del repo; el resto, desde el workspace.
- Ningún tramo de una ruta puede llamarse `.env`, `.env.*` ni `.git`, ni para leer ni para escribir, en el repo ni en el workspace (`isProtected()` en `src/config.js`). Esto importa cuando `ADA_WORKSPACE` apunta a un proyecto real.
- `write_memory` escribe solo dentro de la carpeta de memoria (`areas/`), y tampoco ahí acepta nombres protegidos.
- `run_command` corre sin shell, dentro del workspace, con 60 segundos de límite.
- `web_fetch` solo sale a internet: http o https, y rechaza todo host que resuelva a esta máquina o a la red interna (loopback, rangos privados, metadatos de nube), también a través de redirecciones. Una página leída no puede llevar al agente a tu router ni a una API local.
- El servidor sirve solo `app/` y `docs/`, escucha solo en esta máquina (`127.0.0.1`; `ADA_HOST` lo abre a propósito y lo avisa al arrancar), y la API acepta solo pedidos del propio chat: POST con `application/json`, host local y, si el navegador manda `Origin`, el del mismo servidor. Sin esto, cualquier página abierta en tu navegador podría mandar un POST a localhost y correr herramientas en tu máquina.

## Consecuencias

- Un error de ruta vuelve al modelo como texto ("Archivo protegido", "Ruta fuera de"), y puede corregir el rumbo.
- No es un sandbox real: un programa que el agente ejecuta con `run_command` puede leer lo que tu usuario lee, `.env` incluido. Bien para uso local, no para multiusuario.

## Se verifica en

`tests/unit/tools.test.js`, `tests/unit/http-cli.test.js` y la prueba "seguridad" de `tests/integration/server.test.js`. Cada escape conocido tiene su prueba, y cada prueba se comprobó rompiendo el código a propósito.

## Cuándo revisarla

Si el harness se usa con más de una persona o expuesto a la red: entonces `run_command` va dentro de un contenedor.
