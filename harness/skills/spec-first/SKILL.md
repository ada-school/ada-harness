---
name: spec-first
description: Procedimiento para empezar cualquier feature o cambio no trivial: escribir una spec corta antes de código. Cárgalo cuando el usuario pida construir algo nuevo.
---
# Spec first

Antes de escribir código para una funcionalidad nueva, crea `workspace/specs/<nombre>.md` con exactamente estas secciones:

1. **Objetivo** (una frase): qué podrá hacer el usuario que hoy no puede.
2. **Fuera de alcance**: qué NO se va a hacer en esta iteración.
3. **Interfaz**: funciones, endpoints o comandos que se agregan, con firma.
4. **Criterio de listo**: cómo se verifica, en forma de comandos o pruebas.
5. **Riesgos**: qué podría romperse.

Luego muestra la spec al usuario y espera confirmación antes de implementar. Si el usuario ya dio todos los detalles y la tarea es pequeña, escribe la spec y sigue sin esperar.
