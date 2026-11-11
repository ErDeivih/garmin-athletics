titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: estados del envío con reintento, historial «60 → 62,5 kg» y onboarding visual del envío (móvil → series → reloj)
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Envío con Solicitado/Enviado/Confirmado, reintento visible también tras Enviado y nunca «Recibido» sin acuse; historial «60 → 62,5 kg» con diferencia marcada; onboarding con esquema visual móvil → series → reloj; 79/79 frontend y 25/25 backend, capturas 00/04b/30.

## Bloqueo

**Situación (2026-11-11, 14:40):** los tres criterios están cumplidos y desplegados. Lo
único abierto es la aceptación con el reloj físico.

**(a) Dónde me quedé.** Envío con tres estados y **Reenviar al reloj** (también en Enviado),
historial con **«60 → 62,5 kg»** y `+2,5 kg`, y onboarding con **esquema visual** del envío
(Móvil → Serie 60/65/70 kg → Reloj). Pruebas `envio-estados`, `onboarding` e
`historial-diferencias` en verde; suites 79/79 frontend, 25/25 backend, visual 4/4.

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
