titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: criterios de sesión (serie grande, ±2,5 kg/±1 rep, «anterior», descanso automático), historial con «60 → 62,5 kg» y CSV por serie con sesión, unidad, previsto y real
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Serie actual grande con ±2,5 kg/±1 rep, «anterior» por serie y descanso automático; historial «60 → 62,5 kg» con diferencia marcada; CSV por serie con sesión, unidad, previsto y real (tres series → tres filas); 79/79 frontend y 25/25 backend.

## Bloqueo

**Situación (2026-11-11, 14:10):** los tres criterios están cumplidos y desplegados. Lo
único abierto es la aceptación con el reloj físico.

**(a) Dónde me quedé.** Sesión (modo enfocado y lista con ±2,5 kg/±1 rep, «Anterior» por
serie, discos, descanso automático; una serie se completa sin salir), historial con
«60 → 62,5 kg» y +2,5 kg resaltado, y CSV por serie con `sesion_id`, `sesion`, `unidad`,
`peso_previsto`, `peso_real`, `reps_previstas`, `reps_reales` y `dif`. Suites: 79/79
frontend (38 ficheros), 25/25 backend, visual 4/4.

**(b) Qué falta revisar.**
1. **Prueba física del fr255**: envío real, peso por serie en el reloj, vuelta de una serie
   y medición del detector de reps (≥95 % con error ≤1).
2. Sufijo del tailnet (`servidor.tail4263a0.ts.net` funciona; `ta4283ad.ts.net` no resuelve).
3. Decidir si el alta de plan vacío con ejercicios desde catálogo entra en la biblioteca.

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA
delante) o una tarea distinta; y si quiere el alta de planes desde cero.

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad,
contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real».
Si no, siguiente mejora acordada: alta de plan vacío + añadir ejercicios desde el catálogo.
