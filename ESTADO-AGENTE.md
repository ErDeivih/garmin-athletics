titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: cumplir criterios de historial («60 → 62,5 kg» + corrección), progreso (4 semanas por defecto) y onboarding (flujo visual Planifica → Envía → Entrena)
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Historial con «60 → 62,5 kg» y diferencia resaltada (corrección ya existente), progreso con 4 semanas por defecto y selector 4/8/12, y onboarding con flujo visual; 75/75 frontend y 24/24 backend, capturas 00/21/30.

## Bloqueo

**Situación (2026-11-11, 13:00):** la tanda está entregada y desplegada. Lo único que no puedo
cerrar es la aceptación con el reloj físico.

**(a) Dónde me quedé.** Criterios cumplidos y verificados en captura: historial «60 → 62,5 kg»
con `+2,5 kg` resaltado (`historial-diferencias` rojo → verde); progreso con **4 semanas por
defecto** y selector 4/8/12 (`progreso`); onboarding con **flujo visual** y envío al reloj
explicado (`onboarding`). 75/75 frontend, 24/24 backend, visual 4/4 (línea base del detalle
actualizada). Flujo desplegado OK.

**(b) Qué falta revisar.**
1. **Prueba física del fr255**: envío, peso por serie en el reloj, vuelta de una serie real y
   medición del detector de reps (≥95 % con error ≤1).
2. Sufijo del tailnet (`servidor.tail4263a0.ts.net` funciona; `ta4283ad.ts.net` no resuelve).
3. Decidir si el alta de plan vacío con ejercicios desde catálogo entra en la biblioteca.

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA delante)
o una tarea distinta; y si quiere el alta de planes desde cero.

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad, contrastar
`sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real». Si no, siguiente
mejora acordada: alta de plan vacío + añadir ejercicios desde el catálogo.
