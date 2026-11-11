titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: reverificación de los criterios de sesión, historial y CSV por serie (ya cerrados)
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Sesión (serie grande, ±2,5 kg/±1 rep, «anterior», descanso), historial «60 → 62,5 kg» y CSV por serie con plan/real/sesión están entregados y reverificados en verde; capturas 26, 30 y 24; solo falta la prueba física del reloj.

## Bloqueo

**Situación (2026-11-11, 14:50):** la tanda vuelve a pedir tres criterios que ya están
entregados. No reescribo código que funciona: verifico la regresión, las capturas y el
despliegue, y dejo el resultado aquí.

**(a) Dónde me quedé.** Comprobado ahora mismo:
- Sesión: `sesion-enfocada.test.tsx` en verde (serie 1 de 2 → reps 7 + RPE 8 → descanso →
  serie 2 → nota → POST); captura `26-sesion-enfocada` a 390 px.
- Historial: `historial-diferencias.test.tsx` en verde con «60 → 62,5 kg» y `+2,5 kg`;
  captura `30-historial-diferencias`.
- CSV: `exportar-historial.test.tsx` (3 tests) en verde; **tres series → tres filas**
  (cabecera + 3), con `sesion_id`, `unidad`, `peso_previsto` y `peso_real`; captura
  `24-exportar-historial`.
- Despliegue vivo (`healthz` OK, `/strength/export` y `/watch/ack` responden 401), árbol
  limpio, `master` = `origin/master` (commit `31e49b7`).

**(b) Qué falta revisar.** La **prueba física del fr255**: envío real, peso por serie en el
reloj, vuelta de una serie y medición del detector de reps (≥95 % con error ≤1). Aparte,
confirmar el sufijo del tailnet (`servidor.tail4263a0.ts.net` funciona; `ta4283ad.ts.net`
no resuelve).

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA
delante) o una tarea distinta de verdad; si quiere más alcance en sesión/historial/CSV,
que diga el cambio concreto (hoy no hay nada pendiente en esos tres).

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad,
contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real».
