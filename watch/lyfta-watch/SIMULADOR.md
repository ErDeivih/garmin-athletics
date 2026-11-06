# Diagnóstico del simulador (pantalla negra)

Fecha: 2026-11-06. Entorno: Connect IQ SDK 8.3.0 en Windows, Forerunner 255.

## Qué se probó

1. Se compiló Lyfta para fr255 y se lanzó con `monkeydo`.
2. Se compiló una **app mínima de prueba** (`TEST`) que solo pinta `TEST` en blanco sobre
   negro y se lanzó de la misma forma.
3. Se capturó la ventana del simulador con `PrintWindow` y con captura de pantalla.
4. Se repitió con el simulador reiniciado y el dispositivo fr255.

## Resultado

- El simulador arranca, reconoce el Forerunner 255 y carga la app (la memoria del simulador
  cambia al pasar de la esfera a la app).
- La pantalla se queda **negra también con la app mínima `TEST`**. No hay diálogo de error de
  Monkey C ni excepción de la app.
- El estado inferior del simulador muestra la luz de fondo en **Off**, pero pulsar el botón
  LIGHT o el área de la esfera no cambia la captura.
- `monkeydo` no devuelve error; no hay prompt de firewall pendiente en esta ejecución.

## Conclusión

La pantalla negra **no es de la watch-app**: una app mínima que solo dibuja una palabra también
sale negra. Es un problema de la ventana/representación del simulador en esta máquina (pantalla
apagada o captura de la superficie), no del código de Lyfta.

## Siguiente paso

- Abrir el simulador manualmente, encender la pantalla con LIGHT y ejecutar
  `capture-simulator.ps1 -KeyPath <clave.der>`. El script recorre los cinco modelos.
- Si sigue negra, reiniciar el simulador y probar sin `monkeydo` (File → Open) para separar
  el fallo de la app del fallo de la conexión.
- No se han incluido capturas negras como si fueran pantallas de la app.
