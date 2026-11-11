titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: biblioteca con búsqueda/foco/fechas y duplicar, historial con planificado vs real marcado, y pantalla de sesión con ±2,5 kg / ±1 rep y «anterior» por serie
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Biblioteca (buscar/filtrar/duplicar) con pruebas, diferencias planificado vs real marcadas por serie y controles ±2,5 kg / ±1 rep con «anterior» bajo cada serie; 75/75 frontend y 24/24 backend, capturas 29–31.

## Bloqueo

**Situación (2026-11-11, 12:35):** la tanda está entregada y desplegada. Lo único que no puedo
cerrar es la aceptación con el reloj físico.

**(a) Dónde me quedé.** Biblioteca verificada con sus pruebas (`library-filtros`: búsqueda, foco
y fecha; duplicar). Historial: cada serie del detalle muestra **+2,5 kg / igual que el plan /
−1 reps** con color (`historial-diferencias`). Sesión: **±2,5 kg**, **±1 rep** y **«Anterior: …»
bajo cada serie** en la lista, y ± peso también en el modo enfocado (`sesion-controles`). Suites:
75/75 frontend (36 ficheros), 24/24 backend, visual 4/4 tras actualizar la línea base del
detalle.

**(b) Qué falta revisar.**
1. **Prueba física del fr255**: envío, peso por serie en el reloj, vuelta de una serie real y
   medición del detector de reps (≥95 % con error ≤1).
2. Sufijo del tailnet: `servidor.tail4263a0.ts.net` funciona; `ta4283ad.ts.net` no resuelve.
3. Decidir si «guardar plan con nombre» debe incluir un alta de plan vacío con ejercicios desde
   el catálogo (hoy se crea guardando una sesión como plantilla o importando JSON).

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA delante)
o una tarea distinta; y si quiere el alta de planes desde cero en la biblioteca.

**(d) Siguiente paso concreto.** Con el resultado del envío: importar la actividad, contrastar
`sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj real». Si no, siguiente
mejora acordada: alta de plan vacío + añadir ejercicios desde el catálogo.
