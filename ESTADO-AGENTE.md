titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: modo enfocado de sesión en el gimnasio (serie actual, peso objetivo, «Serie hecha», registro rápido de reps/RPE y descanso) con capturas 26–27
nivel: 2
siguiente: David instala la PWA desde https://servidor.tail4263a0.ts.net (3 pasos) y ejecuta la prueba del reloj de docs/USO-MOVIL.md
bloqueado: prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-10
resumen: Modo enfocado de sesión con registro rápido de reps/RPE y temporizador de descanso; 69/69 frontend y 24/24 backend en verde, capturas 26–27; solo falta la prueba física del reloj.

## Bloqueo

**Situación (2026-11-10, 20:30):** la tanda nueva (modo enfocado + registro rápido) está
entregada y desplegada. Lo único que no puedo cerrar es la aceptación con el reloj físico.

**(a) Dónde me quedé.** Producto verificado en frío: frontend **69/69** en 33 ficheros, backend
**24/24**, regresión visual **4/4**, flujo desplegado OK (`modo_enfocado` y `registro_rapido` a
`true`, sesión guardada con pesos 60/65/70). Capturas `26-sesion-enfocada` y
`27-registro-rapido`. Árbol limpio, `master` = `origin/master`.

**(b) Qué falta revisar.**
1. La **prueba física del fr255**: enviar el entreno desde la app, comprobar el peso por serie
   en el reloj, que una serie real vuelva al backend y medir el detector de repeticiones con
   series contadas a mano (≥95 % con error ≤1 rep).
2. Confirmar el **sufijo del tailnet**: el servidor anuncia `servidor.tail4263a0.ts.net` y
   `ta4283ad.ts.net` todavía no resuelve.
3. Si quiere que el **modo enfocado** use el peso de la última marca cuando no hay objetivo por
   serie (hoy manda el plan, como en la lista) o que permita editar el peso también ahí.

**(c) Qué necesito de David u otro chat.**
- El resultado de la prueba del reloj (reloj cargado, 2FA delante).
- Que confirme cuál es el sufijo correcto del tailnet en el panel de Tailscale.

**(d) Siguiente paso concreto.** Con el resultado del envío y las reps contadas: importar la
actividad, contrastar `sets_imported`/`unmapped`, medir el detector y apagar la tarjeta «Reloj
real» (`AVISO_RELOJ_REAL = false`). Si el envío falla, capturar `workoutId` y el detalle del
error y depurar `push-to-garmin` sin abrir otro backend contra la misma cuenta.
