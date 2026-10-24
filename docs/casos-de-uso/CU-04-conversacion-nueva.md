# CU-04 Empezar una conversación nueva

**Actor:** quien usa el chat.
**Objetivo:** volver a empezar con el contexto vacío, por ejemplo entre dos ejercicios de un taller.
**Precondiciones:** el servidor corre.
**Disparador:** la persona pulsa "Nueva conversación".

## Flujo principal

1. El chat le pide al servidor que olvide las conversaciones.
2. La página se recarga: conversación vacía e inspector en cero.
3. El siguiente mensaje llega al modelo sin turnos anteriores.

## Criterios de aceptación

- **CU-04.1** Dada una conversación con historial, cuando la persona pulsa "Nueva conversación", entonces el servidor la olvida y el siguiente mensaje llega al modelo sin turnos anteriores.
- **CU-04.2** (manual) Dada una conversación con historial, cuando la persona pulsa "Nueva conversación", entonces la pantalla vuelve al estado inicial: conversación vacía e inspector en cero. Verificación: hacer un turno, pulsar el botón y mirar los dos paneles.

## Fuera de alcance

- Borrar solo una conversación cuando hay varias pestañas abiertas: el servidor olvida todas.
