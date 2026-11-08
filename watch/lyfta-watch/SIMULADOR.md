# Simulador y captura

## Causa de la pantalla negra

Confirmado por Codex en el Forerunner 255: Connect IQ llama a `onUpdate(dc)`, no a
`draw(dc)`. La app tenía `draw`; por eso el simulador pintaba una esfera negra aunque el
workout sí estuviera cargado. Se cambió a `onUpdate` en `source/LyftaView.mc`.

## Qué hace `capture-simulator.ps1`

- espera a que exista la ventana del simulador;
- no usa un tiempo fijo: considera que hay **primer fotograma** solo si `PrintWindow`
  devuelve éxito y la zona central contiene píxeles de texto, no el splash azul ni el
  marco gris;
- captura en bucle hasta encontrar ese fotograma;
- comprueba por separado el código de salida de `monkeydo` y el resultado de la captura;
- devuelve error si no hay frame válido y **no guarda una imagen negra**.

## Estado del simulador en esta máquina

En la ventana del simulador están los menús `File > Save Screen Capture`, `Kill App`,
`Reset Simulator`, `Settings > Sleep Mode`, `Force onShow`, etc. Se han probado:

- arrancar el simulador y cargar la app con `monkeydo`;
- pulsar los botones físicos LIGHT/START/BACK y enviar teclas;
- `Force onShow` y `Sleep Mode` por `WM_COMMAND`;
- limpiar `%TEMP%\com.garmin.connectiq` y reinstalar el `.prg`;
- capturar con `PrintWindow` y con `CopyFromScreen`.

La ventana devuelve siempre la misma imagen congelada de la app antigua y el estado
inferior sigue en **Off**. `monkeydo` está conectado y el binario nuevo contiene
`onUpdate`, pero la superficie no se repinta. No se puede afirmar que exista un frame
nuevo; por tanto no hay captura válida y el script termina con error.

## Evidencia del bloqueo

- `screenshots/simulador-bloqueo.png`: ventana congelada con el estado `Off`.
- `screenshots/captura-error.log`: salida de `capture-simulator.ps1` con
  `capture=False`, `nonBlack=False` y `exit=1`. El script no guarda un PNG cuando no
  hay frame válido.

## Siguiente intento

- Abrir el simulador manualmente, usar **File > Save Screen Capture** y comprobar si
  genera un PNG; si lo genera, usar esa ruta como captura oficial.
- Probar `Reset Simulator` y `Delete All Apps` antes de reinstalar.
- Si sigue congelado, es un fallo del simulador de esta instalación, no de la watch-app.
