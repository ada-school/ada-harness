# Taller: Abre un agente por dentro

Material del taller presencial de 45 minutos sobre ADA Harness. Todo lo que necesitas está en esta carpeta.

## Antes de empezar

```bash
git clone https://github.com/ada-school/ada-harness.git
cd ada-harness
cp .env.example .env                      # pega tu clave de Claude o de Gemini
cp docs/taller/descuentos.js workspace/
node src/server.js                        # abre http://localhost:3000
```

En Windows, PowerShell acepta los mismos comandos. Abre el chat siempre en `http://localhost:3000`, nunca con doble clic sobre el HTML.

Sirve una clave de Claude (`ANTHROPIC_API_KEY`) o de Gemini (`GEMINI_API_KEY`); el selector "Modelo" del chat muestra las que tengas. Sin Node 18 o sin clave: trabaja con una pareja que lo tenga.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `descuentos.js` | El código que usamos en la demo y en la práctica. Cópialo a `workspace/`. |
| `plantilla-SKILL.md` | La plantilla de tu primer skill. |
| `documentar-funcion/SKILL.md` | El ejemplo resuelto. |

## La práctica en cuatro pasos

1. Crea tu skill a partir de la plantilla:

   ```bash
   mkdir harness/skills/tu-skill
   cp docs/taller/plantilla-SKILL.md harness/skills/tu-skill/SKILL.md
   ```

2. Edita el archivo. El `name` debe ser igual al nombre de la carpeta, y la `description` va en una sola línea, escrita como disparo: "Cárgalo cuando pidan…".
3. En el chat, pide algo que use las palabras de tu `description`. No hace falta reiniciar el servidor: el índice de skills se relee en cada turno.
4. Busca la evidencia en el inspector: `load_skill` en **Eventos del loop**, y `skillsIndex` más alto en **Capas**.

Para probar el ejemplo resuelto: `cp -r docs/taller/documentar-funcion harness/skills/` y pide "Documenta descuentos.js".

## Si te trabas

| Síntoma | Salida |
|---|---|
| No aparece `load_skill` | La `description` es vaga. Escríbela como "Cárgalo cuando pidan X" y usa la palabra X en tu pedido. |
| `load_skill` da error | El `name` no coincide con la carpeta, o el archivo no se llama `SKILL.md`. |
| Falta la clave (`ANTHROPIC_API_KEY` o `GEMINI_API_KEY`) | Copia `.env.example` a `.env`, pega la clave y reinicia el servidor. |
| "Failed to fetch" en el chat | Abriste el HTML con doble clic. Entra por `http://localhost:3000`. |

## Para casa

Abre `docs/Anatomía de un Agente.html`, capa 5: llena la ventana de contexto y prueba truncar, compactar y descargar a archivos.
