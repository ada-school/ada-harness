# CU-03 Ver qué entró a la ventana de contexto

**Actor:** quien aprende cómo funciona un agente, en un taller o por su cuenta.
**Objetivo:** ver, después de cada turno, qué capas entraron a la última llamada, cuánto pesó cada una y qué hizo el loop.
**Precondiciones:** hubo al menos un turno (CU-01).
**Disparador:** llega la respuesta de un turno.

## Flujo principal

1. El inspector muestra proveedor, modelo y tamaño de la ventana real.
2. El medidor pinta cada capa con su color, en proporción a la ventana.
3. La lista de capas dice cuántos tokens estimados pesó cada una.
4. Los contadores dicen llamadas del turno, herramientas usadas y tokens de entrada reales.
5. Los eventos listan herramientas, compactaciones, avisos y subagentes.

## Flujos alternos

- **1a.** Si el turno no informa ventana, el inspector usa la última conocida.
- **5a.** Si el turno no usó herramientas ni tuvo eventos, el inspector lo dice.
- **5b.** Si el turno terminó en error, el inspector no cambia.

## Criterios de aceptación

- **CU-03.1** Dado un turno, cuando llega la respuesta, entonces el inspector dice el proveedor, el modelo y el tamaño de la ventana real.
- **CU-03.2** Dado un turno, cuando llega la respuesta, entonces el medidor toma la ventana real del modelo como 100% y dice cuántos tokens estimados ocupó la última llamada y qué porcentaje es.
- **CU-03.3** Dado un turno cuyo trace no informa ventana, cuando se actualiza el inspector, entonces usa la última ventana conocida.
- **CU-03.4** Dada cualquier capa, cuando se pinta, entonces usa el mismo color que en el explicador; una capa desconocida usa un gris neutro.
- **CU-03.5** Dado un turno, cuando llega la respuesta, entonces los contadores muestran las llamadas del turno, las herramientas usadas y los tokens de entrada reales que reportó la API.
- **CU-03.6** Dado un turno con herramientas, compactaciones, avisos o subagentes, cuando se listan los eventos, entonces cada uno aparece como texto plano, aunque el modelo haya puesto HTML en la entrada de una herramienta.
- **CU-03.7** Dado un turno sin herramientas ni eventos, cuando se actualiza el inspector, entonces los eventos dicen "Sin herramientas en este turno.".
- **CU-03.8** Dado un turno que terminó en error, cuando llega la respuesta, entonces el inspector conserva la última llamada que sí se completó.

## Fuera de alcance

- Ver el texto completo de cada capa: para eso está el explicador.
- Historial de turnos anteriores en el inspector: muestra solo la última llamada.
