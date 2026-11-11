titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: aplicar feedback GA-U1/U2/I1/I2/F1 (edición en fila, estados del envío, controles 44 px medidos, descanso no bloqueante e integridad de pesos)
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Feedback GA aplicado con medición real (44×44, 0 solapes a 390 px), estados Solicitado/Enviado/Confirmado sin «Recibido» sin acuse, edición de peso en la propia fila, descanso al pie que no bloquea y prueba de integridad 50/52,5/55 kg plan → reloj → guardado; 78/78 frontend y 25/25 backend.

## Bloqueo

**Situación (2026-11-11, 13:35):** feedback aplicado y desplegado. Sigue abierta solo la
aceptación con el reloj físico.

**(a) Dónde me quedé.** GA-U1 (edición en fila), GA-U2 (tres estados, sin «Recibido»),
GA-I1 (44×44 medido: 24 controles, mínimo 44×44, 0 solapes, página 390 px),
GA-I2 (banda de descanso al pie, edición verificada con contador en marcha) y GA-F1
(prueba `tests/test_integridad_pesos.py` con tabla plan → reloj → guardado y localización
de diferencias). 78/78 frontend, 25/25 backend, visual 4/4 con líneas base actualizadas.

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
