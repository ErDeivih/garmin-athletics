titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: capturas de sesión a 390 px sin solapes, historial «60 → 62,5 kg» y caso de uso real con tres pesos guardado en docs/
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Capturas de sesión/descanso a 390 px medidas sin solapes, historial «60 → 62,5 kg» y caso de uso real (60/65/70 kg) documentado en docs/CASO-USO-REAL.md con capturas y CSV/JSON; 79/79 frontend y 25/25 backend.

## Bloqueo

**Situación (2026-11-11, 15:55):** las tres tareas están hechas. Lo único abierto es la
aceptación con el reloj físico.

**(a) Dónde me quedé.** Capturas 26/27/**32** (serie, registro y descanso) a 390 px con
medición real (`24 controles, mínimo 44×44, 0 solapes, página 390 px`) y captura 30 con
**«60 → 62,5 kg»** y `+2,5 kg`. Caso de uso real documentado en `docs/CASO-USO-REAL.md`:
día de empuje con **tres pesos distintos** (60/65/70), resultados (62,5/65/70, volumen 1440
kg), CSV de tres filas y enlaces a `docs/ejemplo-sesion/`; límites declarados (sin envío
real al reloj en la instancia de verificación).

**(b) Qué falta revisar.** La **prueba física del fr255** (envío real, peso por serie en el
reloj, vuelta de una serie y medición del detector de reps ≥95 % con error ≤1).

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA
delante) o una tarea distinta.

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad,
contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real».
