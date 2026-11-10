titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: exportar/importar planes en JSON, ajustes con unidades kg/lb, tema y aviso sin conexión, y onboarding de tres pasos; capturas 00 y 18–20
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-10
resumen: Planes exportables/importables en JSON, ajustes de unidades kg/lb, tema y aviso sin conexión, y onboarding de tres pasos; 62/62 frontend y 22/22 backend en verde, capturas 00 y 18–20; solo falta la prueba física del reloj.

## Bloqueo

**Situación (2026-11-10, commit `1b51b98`):** la tanda 2 está cerrada, desplegada y con el árbol limpio. No hay trabajo de código pendiente; lo que no puedo cerrar es la aceptación con el reloj físico.

**(a) Dónde me quedé.** El producto está completo y verificado en frío (frontend 62/62, backend 22/22, visual 4/4, PWA instalable y offline). Lo único abierto es la prueba con el Forerunner 255: exige el reloj en la muñeca y el 2FA de Garmin, y el móvil `poco-x4-pro-5g` sigue offline en el tailnet desde hace 11 días.

**(b) Qué falta revisar.** 1) Que el entreno enviado desde la app aparezca en el fr255 con el peso objetivo de cada serie. 2) Que una serie real vuelva al backend y se vea en «Últimas sesiones». 3) Medir el detector de repeticiones con series contadas a mano (≥95 % de series con error ≤1 rep). 4) Cuando 1–3 pasen, apagar el aviso «Reloj real» (`AVISO_RELOJ_REAL = false`) y cerrar `WALL.md`. Aparte: confirmar el sufijo del tailnet, porque el servidor anuncia `servidor.tail4263a0.ts.net` y `ta4283ad.ts.net` todavía no resuelve.

**(c) Qué necesito de David (u otro chat con acceso al móvil/reloj).** Reloj cargado, emparejado y sincronizado; 2FA a mano; seguir los 8 pasos de «Lo único pendiente» en `docs/USO-MOVIL.md` y decirme qué sale en cada uno (sobre todo el estado «Enviado al reloj» y las reps reales de la serie). También, que confirme en el panel de Tailscale cuál es el sufijo correcto del tailnet.

**(d) Siguiente paso concreto.** Cuando llegue el resultado del paso 4 (envío) y del 6 (serie con reps contadas): importar la actividad y contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta de aviso. Si el envío falla, capturar `workoutId` y el detalle del error y depurar `push-to-garmin` **sin** levantar otro backend contra la misma cuenta de Garmin.

