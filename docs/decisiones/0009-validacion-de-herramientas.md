# 0009. El servidor valida los argumentos de cada herramienta

**Estado:** aceptada, noviembre de 2026.

## Contexto

El modelo propone argumentos. El proveedor también puede revisarlos, pero cada API lo hace distinto, y un `tool_use` mal formado igual llega al loop. Sin una revisión propia, `write_file` aceptaba propiedades de más y un `content` ausente.

## Decisión

- `src/validation.js` cubre el subconjunto de JSON Schema que usan las definiciones: `type`, `properties`, `required`, `additionalProperties: false`, `enum`, `items`, longitudes y rangos.
- `runTool()` valida contra `input_schema` antes de ejecutar. Los errores vuelven al modelo como texto.
- Un esquema mal formado lanza error: falla cerrado.

## Consecuencias

- El harness no depende de que Anthropic, Gemini u Ollama rechacen la entrada.
- No implementamos el JSON Schema completo. Si una herramienta nueva necesita `oneOf` o `$ref`, hay que ampliar el validador y su prueba.

## Se verifica en

`tests/unit/validation.test.js` y `tests/unit/harness.test.js`.

## Cuándo revisarla

Si una herramienta necesita un constructo que el subconjunto no cubre, o si un proveedor deja de mandar objetos y hay que validar otro formato.
