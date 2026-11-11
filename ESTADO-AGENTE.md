titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: documentar la vía de envío al reloj (API Personal / Training API / plan B Connect IQ, con fuentes y fecha), calculadora de discos y CSV previsto vs real por serie
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-11
resumen: Vía de envío al reloj documentada con fuentes y fechas (API Personal solo lectura, Training API Business y plan B Connect IQ), calculadora de discos en sesión/modo enfocado y CSV con previsto frente a real; 73/73 frontend y 24/24 backend en verde, captura 28.

## Bloqueo

**Situación (2026-11-11, 11:45):** la tanda está entregada y desplegada. Lo único que no puedo
cerrar es la aceptación con el reloj físico; el resto está verificado.

**(a) Dónde me quedé.** `docs/VIA-ENVIO-RELOJ.md` escrito y contrastado (Personal API de octubre
de 2026: clave + token de 24 h, solo lectura; Training API del programa Business: push y
aprobación; cliente no oficial en producción; plan B con Connect IQ vía Communications y
ActivityRecording). Calculadora de discos integrada con prueba propia, y CSV del historial con
`peso_previsto_kg`/`peso_real_kg`/`difs` (backend ampliado por el compañero). Suites: 73/73
frontend, 24/24 backend. Captura `28-discos-en-sesion`.

**(b) Qué falta revisar.**
1. **Prueba física del fr255**: enviar, comprobar peso por serie en el reloj, que vuelva una serie
   real y medir el detector de reps (≥95 % con error ≤1).
2. Si conviene **migrar ya** la lectura de actividades a la Personal API (solo lectura) mientras
   el envío sigue por el cliente no oficial.
3. Sufijo del tailnet: `servidor.tail4263a0.ts.net` funciona; `ta4283ad.ts.net` no resuelve.

**(c) Qué necesito de David.** El resultado de la prueba del reloj (reloj cargado y 2FA delante),
o una tarea distinta; y que confirme si quiere que empiece la migración a la Personal API.

**(d) Siguiente paso concreto.** Con el resultado del envío y las reps contadas: importar la
actividad, contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj
real». Si no, siguiente mejora acordada: leer actividades con la Personal API (API key propia).
