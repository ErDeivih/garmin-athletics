# StatCard

La unidad del panel «Hoy»: una etiqueta, una cifra, una unidad, un delta y una frase de contexto. Una tarjeta cuenta una sola idea.

## Usa

- `ga-stat ga-stat--hero` para la métrica héroe de la pantalla (readiness). Una por pantalla.
- `ga-stat` para las 3-4 secundarias: sueño, HRV, Body Battery, FC en reposo, carga.
- La cifra sale de `type.hero` con cifras tabulares; no se centra ni se parte.
- El pie dice el contexto que hace falta para leer el número: comparación («7 d: 62»), frescura («hace 2 min») o estado («sin dato»).
- El delta lleva signo y unidad, y su color sale de `success` o `danger`; si no hay comparación, no hay delta.

## No uses

- Un cero cuando no hay dato: se escribe «sin dato» y se explica qué falta.
- Más de una serie de datos por tarjeta: para una gráfica hay una pantalla de tendencias.
- Colores de estado para decorar una tarjeta neutra.
- Texto dentro del número: la unidad va en `caption`, no pegada a la cifra.
