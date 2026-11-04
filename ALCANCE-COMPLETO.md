# Alcance completo — Garmin Athletics

Escrito el 2026-11-04 por indicación de David. **Este documento amplía el alcance**: no es un panel de lectura, es una **app de entrenamiento completa** que compita con la de Garmin y la supere en lo que David usa de verdad.

## Qué es

La app donde David **crea** entrenamientos, los **lleva al reloj**, los **ejecuta** y luego **analiza** todo lo que Garmin mide. Sustituye a Garmin Connect para el uso diario y **añade** lo que Garmin hace mal: crear entrenamientos de gimnasio con series, pesos y repeticiones.

## 1. Datos y gráficas

- Todas las métricas que ya ingiere el backend, con **gráficas de todo tipo**: línea, barras, área, dispersión, calor, distribución, calendario de actividad.
- **Métricas derivadas** propias: carga aguda/crónica (ATL/CTL), TSB, monotonía, tensión de entrenamiento, volumen por grupo muscular, progresión de fuerza, 1RM estimado, ratio empuje/tirón, tiempo bajo tensión.
- **Panel de Hoy** (readiness, sueño, HRV, Body Battery, FC, estrés) y **Tendencias** con periodos comparables (7/30/90 días, mes, año).
- Cada gráfica con su estado vacío honesto: si no hay datos, se dice; **no se inventa una serie**.

## 2. Crear entrenamientos

- Gimnasio: ejercicios con **series, repeticiones, peso, descanso y RPE**; supersets; drop sets; tempo.
- **Tipos de ejercicio con dibujo/icono** (dos posiciones: inicio y fin del movimiento) para que en el reloj se vea qué hacer.
- Fuerza por tiempo y por repeticiones; isométricos; peso corporal.
- **Running, bici y natación** por objetivos: distancia, tiempo, zonas de FC, intervalos, series con recuperación.
- **Plantillas reutilizables** y duplicar la semana anterior.
- Máxima personalización: David quiere poder ajustarlo todo.

## 3. Ejecutar y registrar

- Registro **según entrenamiento establecido** o **entrenamiento libre sobre la marcha**.
- Dos toques por serie: marcar hecha y corregir peso/reps en el momento.
- Descanso automático, resumen de sesión, guardar sesión como plantilla.
- Corrección posterior: si se equivocó en una serie, se arregla y se recalcula el tonelaje.

## 4. El reloj: aquí está la diferencia

David lo pidió explícito: **tener en el reloj los ejercicios, los pesos y las repeticiones**, dar a empezar y que **registre los esfuerzos según los movimientos**.

- **Exportar el entrenamiento al reloj** (ejercicios, orden, series, pesos, reps, descansos).
- En el reloj: ver el ejercicio (con su dibujo), el peso y las reps que toca, **marcar serie hecha**, y que la app lo reciba de vuelta.
- **Registrar la mano** en la que se lleva el reloj (izquierda/derecha) y usarlo para interpretar los movimientos.
- **Detección del esfuerzo por movimiento**: reconocer la serie por el gesto del brazo (acelerómetro/giroscopio del reloj) y contar la repetición, sin tocar el reloj.

### Lo que hay que investigar antes de prometerlo

- **Connect IQ** (el SDK de Garmin **ya está instalado** en este equipo:
  `C:\Users\David\AppData\Roaming\Garmin\ConnectIQ\Sdks\connectiq-sdk-win-8.3.0`).
  Un *watch app* o *data field* propio es el camino para la parte del reloj: mostrar la sesión, contar repeticiones y mandar los datos al móvil/backend.
- La API pública de Garmin Connect **no permite empujar entrenamientos** de forma oficial. Hay que documentar qué es posible de verdad (Connect IQ, exportación `.fit`/`.tcx`, cola manual) y **no prometer lo que no existe**.
- La detección de repeticiones por acelerómetro es un problema conocido (rep counting por IMU). Hay papers y proyectos abiertos; hay que citar la fuente, no improvisar.

## 5. UI/UX

- Investigación real de la competencia (Garmin Connect, Strava, Hevy, Strong, Fitbod, Apple Fitness, Fitbit) **con capturas**.
- El diseño se hace sobre el **sistema de diseño** que ya existe (`designs/garmin-athletics-design-system/`).
- **Móvil primero**, que es donde se usa la app en el gimnasio. Y escritorio bien resuelto para crear y analizar.
- Estados por pantalla: vacío, cargando, error y sin permiso.

## Orden de valor

1. Gráficas y métricas derivadas (lo que engancha y ya hay datos).
2. Registro de sesión de gimnasio (el corazón del producto).
3. Creación de entrenamientos con dibujos y descansos.
4. **Reloj** (Connect IQ): ver la sesión y devolver los datos.
5. Detección de repeticiones por movimiento (lo más difícil, lo último).

## Reglas

- Sin GitHub Actions. Push selectivo.
- Nada de secretos en git (`.env`, `garmin_tokens`, la base de datos).
- No tocar `frontend/` ni `frontend_mvp/`.
- Pruebas de flujo, no de detalle. Toda métrica que se muestre **se mide o no se muestra**.
- Cada promesa sobre el reloj lleva **fuente o prueba**: si no se ha verificado en el reloj, se dice.
