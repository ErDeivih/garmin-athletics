titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: capturas de sesión y descanso a 390 px sin solapes, historial «60 → 62,5 kg» y vía de envío documentada en docs/ENVIO-AL-RELOJ.md
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Capturas de sesión a 390 px con 24 controles ≥44×44 y 0 solapes (incluida la del descanso), historial «60 → 62,5 kg» y vía de envío con fuentes y plan B en docs/ENVIO-AL-RELOJ.md; 79/79 frontend y 25/25 backend.

## Bloqueo

**Situación (2026-11-11, 15:40):** las tres tareas están hechas. Lo único abierto es la
aceptación con el reloj físico.

**(a) Dónde me quedé.** Captura nueva `32-descanso-sesion` (serie 2 de 3 con temporizador,
«Saltar descanso» y «Serie hecha» deshabilitado mientras corre) y capturas 26/27; medición
real en navegador: **24 controles, mínimo 44×44, 0 solapes, página 390 px**. Historial
«60 → 62,5 kg» en `30-historial-diferencias`. Vía de envío en `docs/ENVIO-AL-RELOJ.md`
(antes `VIA-ENVIO-RELOJ.md`) con API Personal, Training API, cliente actual y plan B
Connect IQ, con fuentes y fechas.

**(b) Qué falta revisar.** La **prueba física del fr255** (envío real, peso por serie en el
reloj, vuelta de una serie y medición del detector de reps ≥95 % con error ≤1).

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA
delante) o una tarea distinta.

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad,
contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real».
