titulo: Lyfta — entrenamiento, reloj y análisis
estado: desplegado y verificado; en-espera de la prueba física del reloj
tarea: pesos por serie arreglados con prueba rojo→verde y verificados en el despliegue (sesión guardada 60/65/70); app en dos puertas y dossier de interfaz con antes/después
nivel: 2
siguiente: David abre http://192.168.1.139:8010 (en casa) o http://100.117.58.93:8010 (con Tailscale) y ejecuta PENDIENTE-PRUEBA-RELOJ.md §7 con el fr255 delante
bloqueado: prueba física del fr255 (2FA/reloj de David); PWA completa espera que David active los certificados HTTPS del tailnet
fecha: 2026-11-09
resumen: Los pesos por serie ya llegan a la sesión guardada —el borrador de la sesión ignoraba `set_targets` y ahora cada serie usa su objetivo, con prueba rojo→verde y verificado en el despliegue (60/65/70 y 1420 kg)—; quedan la prueba física del fr255 y el interruptor HTTPS del tailnet.
