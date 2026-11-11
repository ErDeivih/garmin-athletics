titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: sesión de ejemplo real ejecutada y guardada en docs/ejemplo-sesion (capturas 390 px, CSV y JSON)
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Sesión de ejemplo real ejecutada contra la instancia desechable y guardada en docs/EJEMPLO-SESION.md con 5 capturas a 390 px, CSV por serie (60→62,5 / 65→65 / 70→70) y JSON; 79/79 frontend y 25/25 backend.

## Bloqueo

**Situación (2026-11-11, 15:05):** la sesión de ejemplo está hecha y guardada. Lo único
abierto sigue siendo la prueba física del reloj.

**(a) Dónde me quedé.** `docs/EJEMPLO-SESION.md` con la sesión real (usuario temporal en la
instancia desechable): plan 60/65/70, modo enfocado con RPE 8, corrección de la serie 1 a
62,5 kg y exportación. Adjuntos en `docs/ejemplo-sesion/`: `01`–`05` capturas a 390 × 844,
`sesion-ejemplo.csv` (3 series → 3 filas) y `sesion-ejemplo.json`. Script que lo reproduce:
`frontend-nuevo/scripts/ejemplo-sesion.mjs`.

**(b) Qué falta revisar.** La **prueba física del fr255** (envío real, peso por serie en el
reloj, vuelta de una serie y medición del detector de reps ≥95 % con error ≤1). La sesión
de ejemplo no cubre el envío a Garmin: la instancia desechable no tiene credencial.

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA
delante) o una tarea distinta.

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad,
contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real».
