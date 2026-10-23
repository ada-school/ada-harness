# Skills

Un skill es una carpeta con un `SKILL.md`. El frontmatter (`name`, `description`) entra al contexto en cada llamada como parte del índice. El cuerpo entra solo cuando el agente llama `load_skill(name)`.

Escribe la `description` como la condición de disparo: "cárgalo cuando...". Esa frase es lo que el modelo usa para decidir.

Un skill es un procedimiento, no una enciclopedia. Si supera 200 líneas, divídelo o pon el material de referencia en archivos aparte que el skill indique leer.
