---
name: documentar-funcion
description: Documents JS functions. Load it when they ask to document.
---
# Document a function

1. Read the file with read_file.
2. Above each exported function, a JSDoc block:
   @param with a type, @returns, and a real @example.
3. An unhandled edge case: do not fix it,
   note it in RIESGOS.md.
4. Save with write_file.
