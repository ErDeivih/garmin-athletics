titulo: Lyfta — entrenamiento, reloj y análisis
estado: desplegado y verificado desde el móvil; en-espera de la prueba física del reloj
tarea: app desplegada en dos puertas (red de casa y tailnet) y flujo completo recorrido contra el despliegue; revisión de interfaz con capturas a 390 px y 10 problemas
nivel: 2
siguiente: David abre http://192.168.1.139:8010 (en casa) o http://100.117.58.93:8010 (con Tailscale) y ejecuta PENDIENTE-PRUEBA-RELOJ.md §7 con el fr255 delante
bloqueado: prueba física del fr255 (2FA/reloj de David); PWA completa espera certificados HTTPS del tailnet; los pesos por serie del plan no llegan a la sesión (hallazgo que hay que decidir si se arregla)
fecha: 2026-11-09
resumen: Lyfta se abre desde el móvil en casa (192.168.1.139:8010) y en cualquier sitio por el túnel Tailscale (100.117.58.93:8010), con el flujo completo verificado contra el despliegue; quedan la prueba física del fr255 y decidir el arreglo de los pesos por serie.
