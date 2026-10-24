# CU-02 Elegir con qué modelo habla

**Actor:** quien usa el chat.
**Objetivo:** hablar con Claude, Gemini o un modelo local de Ollama, y saber por qué alguno no está disponible.
**Precondiciones:** el servidor corre.
**Disparador:** la persona abre el selector "Modelo", o el chat termina de cargar.

## Flujo principal

1. Al cargar, el chat pide al servidor los proveedores y su estado.
2. El selector muestra Claude y Gemini, y un grupo con cada modelo de Ollama detectado.
3. Queda elegido el último modelo que la persona usó, si sigue disponible.
4. La persona elige otro modelo.
5. El chat empieza una conversación nueva, en la pantalla y en el servidor, y avisa con quién habla ahora.

## Flujos alternos

- **2a.** Un proveedor sin clave aparece deshabilitado y dice qué variable falta.
- **2b.** Si Ollama no responde, una opción deshabilitada dice cómo instalarlo y arrancarlo.
- **3a.** Si ningún modelo está disponible, la conversación explica cómo conseguir uno.
- **4a.** Si la persona arranca Ollama con la página abierta, al volver a abrir el selector aparecen sus modelos.

## Criterios de aceptación

- **CU-02.1** Dado Claude o Gemini sin su clave, cuando se abre el selector, entonces aparecen deshabilitados y dicen qué variable falta; con clave, se pueden elegir y muestran su modelo.
- **CU-02.2** Dado Ollama con modelos instalados, cuando se abre el selector, entonces aparecen agrupados bajo "Ollama" con su host, cada uno marcado local, nube o sin herramientas, y los que no usan herramientas no se pueden elegir.
- **CU-02.3** Dado que Ollama no responde, cuando se abre el selector, entonces una opción deshabilitada dice cómo instalarlo y arrancarlo.
- **CU-02.4** Dado que ya hay un modelo elegido o uno guardado de otra visita, cuando el selector se vuelve a llenar, entonces se mantiene ese modelo si sigue disponible; si no, queda el que el servidor marca por defecto, y nunca uno deshabilitado.
- **CU-02.5** Dado un modelo con ":" en el nombre (por ejemplo qwen3:8b), cuando se envía un mensaje, entonces el servidor recibe el proveedor y el modelo separados correctamente.
- **CU-02.6** Dada una conversación en curso, cuando la persona cambia de modelo o de proveedor, entonces empieza una conversación nueva en la pantalla y en el servidor, y el chat avisa con quién habla ahora.
- **CU-02.7** Dado que ningún modelo está disponible, cuando carga el chat, entonces la conversación explica cómo conseguir uno.

## Fuera de alcance

- Elegir un modelo distinto para los subagentes desde la pantalla: eso se decide en `routing.json`.
