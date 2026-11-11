titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: captura de sesión a 390 px sin solapes, historial «60 → 62,5 kg» y prototipo HTML de la sesión en curso para la galería
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Capturas de sesión a 390 px (sin scroll ni solapes), historial «60 → 62,5 kg» y prototipo HTML autocontenido de la sesión en curso con datos ficticios marcados y captura 33; 80/80 frontend y 25/25 backend.

## Bloqueo

**Situación (2026-11-11, 16:40):** las tres tareas están hechas. Lo único abierto es la
aceptación con el reloj físico.

**(a) Dónde me quedé.** Capturas 26/32 (serie grande, ±2,5 kg, «Anterior», discos y descanso)
medidas sin scroll (844 = 844) ni solapes (24 controles ≥44×44); historial «60 → 62,5 kg» en
30; y **prototipo HTML** `docs/prototipo-sesion.html` (un solo fichero, datos ficticios
marcados, serie grande de 65 kg y descanso), con captura `33-prototipo-sesion` y script
`captura-prototipo.mjs` que verifica en navegador que se abre y muestra la serie.

**(b) Qué falta revisar.** La **prueba física del fr255** (envío real, peso por serie en el
reloj, vuelta de una serie y medición del detector de reps ≥95 % con error ≤1).

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA
delante) o una tarea distinta.

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad,
contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real».
