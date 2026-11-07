# Simulador y captura

## Causa de la pantalla negra

Confirmado por Codex en el Forerunner 255: Connect IQ llama a `onUpdate(dc)`, no a
`draw(dc)`. La app tenía `draw`; por eso el simulador pintaba una esfera negra aunque el
workout sí estuviera cargado. Se cambió a `onUpdate` en
`source/LyftaView.mc` y la app compila para los cinco modelos.

## Captura

`capture-simulator.ps1` ya no espera un tiempo fijo. Ahora:

- espera a que exista la ventana del simulador;
- considera que hay **primer fotograma** solo si `PrintWindow` devuelve éxito y la zona
  central tiene píxeles de texto (no el splash azul ni el marco gris);
- captura en bucle hasta encontrar ese fotograma;
- comprueba por separado el código de salida de `monkeydo` y el resultado de la captura;
- devuelve error si algún modelo no produce un fotograma válido.

La captura del fr255 se ha intentado; el simulador de esta máquina sigue apagando la
pantalla (`Off`) y no entrega un fotograma de la app nueva. No se incluyen imágenes
negras ni capturas antiguas como si fueran la pantalla actual.

## Maquetación fr255

La pantalla se ha compactado para 260×260: fuente de peso con glifos normales (no la
fuente numérica), `Peso (kg)` y objetivo separados, y los textos inferiores dentro del
círculo. La captura física queda pendiente de que el simulador encienda la pantalla.
