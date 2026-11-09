# Revisión de interfaz de Lyfta — dossier para un revisor externo

**Qué es este documento.** Un paquete autocontenido para que otro modelo (Claude / GPT / Codex) juzgue la interfaz de Lyfta **sin acceso al ordenador ni al repositorio**. Contiene el inventario de pantallas, los estados y textos reales, cómo se navega, el mapa de capturas y tres problemas de diseño con evidencia. No es una propuesta de rediseño: es el material de trabajo para que el revisor externo lo haga.

**Cómo se ha producido.** Fecha del dossier: 2026-11-09 (capturas tomadas el 2026-11-08). Se ha leído completo `frontend-nuevo/src/` (rutas, navegación, banderas, las 21 pantallas y las primitivas de UI) y se han abierto **27 de las 33 capturas**; las 6 restantes son duplicados byte a byte de otras (comparadas por SHA-256, ver §5.3), así que en la práctica **todo estado capturado** está descrito aquí. No se ha ejecutado la app: no hay observaciones de comportamiento en vivo, teclado real, lector de pantalla ni tema claro capturado.

**Aviso importante antes de juzgar las capturas:** no todas son del mismo build. Hay al menos dos versiones mezcladas y en varios sitios el código actual no coincide con la captura (§5.3). Cada fila de la tabla de capturas indica la pantalla y el estado, y las discrepancias están marcadas.

---

## Resumen ejecutivo (para el revisor con prisa)

- La app es **una web móvil de entrenamiento de fuerza**: crear rutinas con pesos por serie, enviarlas al reloj Garmin, ejecutar la sesión marcando series y analizar actividades. Backend FastAPI, frontend React + Vite, tema oscuro por defecto (fondo `#0A0E13`, acento cian `#22D3EE`), tipografía Barlow/Barlow Condensed, viewport de referencia **390×844 CSS** (las capturas son 780 px de ancho, DPR 2).
- **21 pantallas**: 3 pestañas fijas (Hoy, Gimnasio, Ajustes), 6 secciones detrás de la bandera `extended`, 6 pantallas secundarias de gimnasio que se alcanzan solo por enlace, más login, arranque, error de arranque, «sección no disponible» y 404.
- **La navegación móvil es de 3 pestañas + una fila de 6 chips desplazable** para lo extendido. Las pantallas secundarias no tienen botón atrás: vuelven con enlaces de texto.
- **El estado vacío de la portada es el punto más flojo**: `Hoy` sin biometría es una tarjeta y ~400 px de negro, y no dice qué entrenamiento toca (§6.1).
- **La pantalla de sesión no tiene modo foco**: barra de pestañas activa, «Descartar» y «Terminar sesión» duplicados arriba y abajo (§6.2).
- **Los filtros de Actividades están siempre desplegados** y ocupan ~280 px CSS antes de la primera tarjeta (§6.3).

---

## 1. Qué es Lyfta y cómo se usa

Lyfta es una app web pensada para el móvil que cubre el ciclo completo del entrenamiento de fuerza: el atleta crea una rutina (plantilla) con sus ejercicios, series, repeticiones y **peso por serie**; ajusta esos pesos; envía la rutina al reloj Garmin para tenerla en la muñeca; ejecuta la sesión en la app marcando cada serie como hecha (con un temporizador de descanso que sigue corriendo aunque se bloquee el móvil); y al terminar revisa el resumen, la corrige y consulta su historial, su carga de entrenamiento y —si conecta su cuenta Garmin— su recuperación (sueño, HRV, Body Battery) y sus actividades. **El contexto de uso manda:** móvil, **una sola mano**, **en el gimnasio**, **entre serie y serie**, con sudor, prisa, mala luz o luz de fluorescente, el móvil apoyado en una máquina o en el bolsillo y el pulgar como único puntero. Todo lo que exija teclado, precisión o dos toques compite contra el descanso entre series. Este documento juzga la interfaz con ese listón.

---

## 2. Inventario de pantallas

`extended` es la bandera de `src/config/features.ts` (clave `localStorage.lyfta.extended`, con migración desde `carga.extended` y `pulso.extended`, o `VITE_FEATURE_EXTENDED`). El router se genera desde `NAV_ITEMS` (`src/config/navigation.ts`) y la bandera decide qué entradas están encendidas (`src/App.tsx:87-114`).

| # | Pantalla | Ruta | Para qué sirve | ¿Siempre visible? | Fichero fuente |
|---|----------|------|----------------|-------------------|----------------|
| 1 | Entrar (login) | — (no es ruta: se pinta cuando no hay sesión) | Única puerta de entrada; email + contraseña | Sí, antes de autenticar | `src/pages/LoginPage.tsx` |
| 2 | Arranque | — (mientras `/auth/me` valida el token) | Comprobar la sesión guardada | Sí, al arrancar con token | `src/App.tsx:30-42` |
| 3 | Error de arranque | — (si `/auth/me` falla por red, no por 401) | Reintentar la comprobación | Sí, cuando ocurre | `src/App.tsx:44-52` |
| 4 | Hoy | `/` | Panel de disposición: readiness, sueño, HRV, FC, estrés, carga, Body Battery, avisos | Sí · pestaña inferior «Hoy» | `src/pages/TodayPage.tsx` |
| 5 | Gimnasio | `/gimnasio` | Entreno de hoy, envío al reloj, plantillas, últimas sesiones | Sí · pestaña «Gimnasio» | `src/pages/GymPage.tsx` |
| 6 | Ajustes | `/ajustes` | Conexión Garmin, tema, secciones, cuenta | Sí · pestaña «Ajustes» | `src/pages/SettingsPage.tsx` |
| 7 | Actividades | `/actividades` | Historial de actividades con búsqueda, fechas y deporte | No · bandera `extended` (chip superior) | `src/pages/extended/ActivitiesPage.tsx` |
| 8 | Actividad (detalle) | `/actividades/:id` | Métricas, zonas, vueltas, meteo, recorrido, gráficas, parciales | No · bandera `extended` (y no tiene chip propio) | `src/pages/extended/ActivityDetailPage.tsx` |
| 9 | Calendario | `/calendario` | Programar entrenamientos (semanal o un día), semana, auto-carga al reloj | No · bandera `extended` | `src/pages/extended/CalendarPage.tsx` |
| 10 | Tendencias | `/tendencias` | Métrica seleccionable, carga aguda/forma, semanal, heatmap, sueño, gimnasio | No · bandera `extended` | `src/pages/extended/TrendsPage.tsx` |
| 11 | Rendimiento | `/rendimiento` | Resumen 30 días, zonas de FC, marcas | No · bandera `extended` | `src/pages/extended/PerformancePage.tsx` |
| 12 | Rutas | `/rutas` | Generar rutas por pasos, perfil, GPX para el reloj | No · bandera `extended` | `src/pages/extended/RoutesPage.tsx` |
| 13 | Social | `/social` | Clasificación semanal de carga | No · bandera `extended` | `src/pages/extended/SocialPage.tsx` |
| 14 | Sección no disponible | — (sustituye al elemento de cada ruta `extended` si la bandera está apagada) | Explicar que la sección se activa en Ajustes | Solo con `extended` apagado | `src/pages/extended/UnavailablePage.tsx` |
| 15 | Entrenar | `/gimnasio/entrenar?template=<id>` | Ejecutar la sesión serie a serie y ver el resumen al terminar | No está en la navegación · enlace desde Gimnasio y Biblioteca | `src/pages/SessionPage.tsx` |
| 16 | Detección de repeticiones | `/gimnasio/ejercicios/:id/deteccion` | Activar/desactivar el conteo automático por ejercicio | No está en la navegación · enlace desde Catálogo | `src/pages/MotionProfilePage.tsx` |
| 17 | Editar pesos reales | `/gimnasio/sesiones/:id` | Corregir el peso real de una sesión ya guardada | No está en la navegación · enlace desde Gimnasio | `src/pages/SessionEditPage.tsx` |
| 18 | Editar pesos | `/gimnasio/plantillas/:id` | Ajustar el peso objetivo de cada serie de una plantilla | No está en la navegación · enlace desde Gimnasio | `src/pages/PlanEditorPage.tsx` |
| 19 | Catálogo | `/gimnasio/catalogo` | Ejercicios con ilustración inicio/fin y acceso a detección | No está en la navegación · enlace desde Gimnasio | `src/pages/extended/CatalogPage.tsx` |
| 20 | Biblioteca | `/gimnasio/biblioteca` | Rutinas ordenadas por foco y fase, con series y peso | No está en la navegación · enlace desde Gimnasio | `src/pages/extended/LibraryPage.tsx` |
| 21 | Página no encontrada | `*` | Aviso de URL inexistente | Sí, para cualquier URL desconocida | `src/App.tsx:58-67` |

**Notas de inventario que un revisor debe saber:**

- `CatalogPage` y `LibraryPage` viven en `src/pages/extended/` pero **no llevan bandera**: no están en `NAV_ITEMS`, se alcanzan siempre desde la cabecera de Gimnasio. En cambio `ActivityDetailPage`, en esa misma carpeta, **sí** es `extended` (`src/App.tsx:104-111`).
- De los 10 ficheros de `src/pages/extended/`, 7 están detrás de la bandera (Actividades, Actividad, Calendario, Tendencias, Rendimiento, Rutas, Social); `CatalogPage`, `LibraryPage` y `UnavailablePage` no.
- Las rutas con `extended` apagada **siguen existiendo**: si se escribe la URL a mano se ve `Sección no disponible`, no un 404 (`src/App.tsx:54-56` y `:104-111`).

---

## 3. Estados y textos exactos, pantalla por pantalla

Convenciones de esta sección:

- Los textos entre « » son **literales del código** (copiados carácter a carácter, incluidas las discordancias de plural y las mayúsculas). Los textos de datos (nombres de plantilla, fechas, importes) se indican con `{variable}`.
- Tres primitivas son globales y no se repiten en cada pantalla: **cargando** = esqueleto gris con texto solo para lectores de pantalla (`LoadingBlock`, `src/components/ui.tsx:165-174`); **error** = caja roja con encabezado «No se han podido cargar los datos», mensaje concreto y botón «Reintentar» (`ErrorState`, `ui.tsx:147-163`); **vacío** = caja de borde discontinuo con icono de bandeja, título, descripción y acción opcional (`EmptyState`, `ui.tsx:128-145`).
- Cuando se dice «no existe», significa que **no hay rama de código** que lo pinte: no es que falte captura.

### 3.1 Entrar (login) — sin ruta — `src/pages/LoginPage.tsx`

**Estados que existen**
- Por defecto (sin sesión): marca «Lyfta» + «Entrena»; título «Entra en Lyfta»; subtítulo «Tu entrenamiento y su análisis, en un solo sitio.»; campos «Correo» y «Contraseña»; botón «Entrar», deshabilitado mientras falte correo o contraseña.
- Envío en curso: botón «Entrando…» y deshabilitado.
- Error de credenciales: banda roja con el mensaje que devuelve la API o, si no es un `Error`, «No se pudo entrar.».
- Sesión caducada (un 401 a mitad de uso): banda ámbar «La sesión ha caducado. Vuelve a entrar para seguir donde estabas.».
- Éxito: navega a `/` sin mensaje.

**Estados que NO existen**
- No hay estado de carga de pantalla (los campos están siempre).
- No hay «he olvidado mi contraseña», ni registro, ni enlace a crear cuenta (el alta se hace en la API; comentario en `LoginPage.tsx:7`).
- No hay validación de formato: `noValidate` en el formulario y el botón solo se deshabilita con campos vacíos.

### 3.2 Arranque y error de arranque — `src/App.tsx:30-52`

- Arranque: marca «Lyfta»/«Entrena» y esqueleto con texto para lector de pantalla «Comprobando la sesión».
- Error: caja de error con el mensaje del fallo o «No se pudo comprobar la sesión.» y botón «Reintentar».
- **No existe** un estado de «sin conexión» específico, ni reintento automático (el reintento es manual).

### 3.3 Hoy — `/` — `src/pages/TodayPage.tsx`

**Estados que existen**
- Cargando (datos diarios o estado de sincronización pendientes): cabecera «Hoy» y esqueleto «Cargando el panel de hoy».
- Error de datos: «Hoy» + error «No se pudieron cargar tus datos de hoy.» + «Reintentar».
- **Vacío por falta de biometría** (`biometrics_available === false`): título «Sin datos de hoy»; descripción según conexión: si la cuenta está vinculada «Todavía no hay datos de hoy. Sincroniza para verlos.» con botón «Sincronizar ahora» / «Sincronizando…»; si no está vinculada «Conecta tu cuenta para ver tu disposición.» con enlace «Vincular cuenta». Si la sincronización falla: «No se pudo sincronizar. Inténtalo otra vez.».
- Datos disponibles: cabecera «Hoy» / «Tu disposición · {fecha larga}»; tarjeta «Disposición» con «Tu estado para entrenar hoy.», `{score}` «/ 100», el mensaje de readiness del backend y una insignia «Listo» (VERDE) / «Con cuidado» (AMARILLO) / «Descansa» (ROJO).
- Métricas: «Sueño» («Cuánto y cómo has dormido.»; unidad «h» o «sin dato»; «Puntuación {n}»; «Media 7 d: {n} h»), «HRV» («Variación entre latidos.»; «ms» o «sin dato»; estado «En tu media» / «Por debajo de tu media» / «Por encima de tu media» / «Sin dato»), «FC en reposo» («Tu carga en calma.» / «lpm»), «Estrés» («Cuánto ha subido tu carga sin esfuerzo.» / «/ 100» / «Media del día»), «Frescura» («Positivo: descansado. Negativo: cargado.» / «Carga aguda {n} · Forma {n}»).
- Aviso de conexión (`SyncBanner`, solo en la rama con datos): error «No se pudo comprobar la conexión.»; reautenticación «Vuelve a vincular tu cuenta.» + enlace «Revisar conexión»; sin vincular «Conecta tu cuenta para ver tus datos.» + enlace «Vincular».
- «Carga de entrenamiento» («Últimos 30 días»; «Carga aguda: lo que has entrenado esta semana. Forma: lo acumulado en las últimas semanas.»): cargando «Cargando la carga…», error «No se pudo cargar la carga.», vacío de gráfica «La API no ha devuelto suficiente serie para dibujar la carga.».
- «Body Battery» («Hoy»; «Energía disponible a lo largo del día.»; «Al despertar {n} / 100 · máx {n} · mín {n}»); sin curva «Sin curva de Body Battery para hoy.».
- «Avisos» (pista «{n} avisos»): cargando «Cargando avisos…», error «No se pudieron cargar los avisos.», vacío «Ningún aviso para hoy.», insignias «Importante» / «Aviso» / «Info».

**Estados que NO existen**
- **No hay ninguna sección con el entrenamiento del día** (ni plantilla, ni «Empezar sesión»): la portada es solo un panel de recuperación. El entreno de hoy vive únicamente en Gimnasio (`GymPage.tsx:84-107`). Es la base del problema §6.1.
- No hay confirmación de éxito al sincronizar desde aquí (`useSyncNow` invalida consultas y la tarjeta cambia de estado, pero no hay mensaje «sincronizado»; en Ajustes sí se muestra `syncNow.data.message`).
- No hay botón de reintento del banner de conexión (solo enlaces a Ajustes).

### 3.4 Gimnasio — `/gimnasio` — `src/pages/GymPage.tsx`

**Estados que existen**
- Cargando: cabecera «Gimnasio» / «Entrenamiento de fuerza.» + esqueleto «Cargando el gimnasio».
- Error: misma cabecera + error `{mensaje de la API}` o «No se pudo leer el gimnasio.» + «Reintentar».
- Con datos: cabecera «Gimnasio» / «Tu entreno de hoy, tus plantillas y tu historial.» y acciones «Biblioteca», «Catálogo».
- «Hoy toca» (pista con el día de la semana): con plantilla, nombre en mayúsculas, «{n} ejercicios · {n} series · {n} kg», enlace «Empezar sesión» e insignia «Series, descanso y esfuerzo». Sin plantilla: «No hay ninguna plantilla asignada a {día en minúsculas}.».
- «Enviar al reloj»: sin plantilla hoy «Elige un entreno para enviarlo.»; cargando «Cargando…»; error de plantilla «No se pudo cargar el entreno.».
- Con plantilla: «{n} ejercicios · {n} series», enlace «Editar pesos», etiqueta «Estado del envío» e insignia «Enviando…» / «Error» / «Enviado» / «Pendiente»; botón «Enviar al reloj» / «Enviando…».
- Éxito del envío: caja verde «Enviado al reloj» + «Si no aparece, acerca el reloj y sincroniza.» (y la insignia pasa a «Enviado»).
- Error del envío: caja roja «No se pudo enviar» + «Acerca el reloj, sincroniza y vuelve a intentarlo.» + botón «Reintentar».
- Sin haber enviado: «Tú decides cuándo; el reloj solo muestra el objetivo.».
- «Tus plantillas» (pista «{n} en total»): vacío «Todavía no hay plantillas» / «Una plantilla es la rutina que repites: ejercicios, series, peso y descanso.»; cada plantilla «{día} · {n} ejercicios · {n} series», «{kg}», botones «Pesos» y «Empezar».
- «Últimas sesiones» (pista «5 últimas»): vacío «Todavía no hay sesiones» / «Aquí aparecerá cada sesión terminada con su volumen y su duración.»; fila con fecha, «{kg}», «{n} series», duración y enlace «Corregir pesos».

**Estados que NO existen**
- No hay estado «enviado anteriormente» persistido: el resultado del envío es una mutación en memoria (`usePushWorkout`, `GymPage.tsx:19`), así que al salir de la pantalla y volver la insignia vuelve a «Pendiente». Ver §6.4.
- No hay confirmación de que el reloj lo haya recibido (el texto lo delega a «si no aparece, acerca el reloj y sincroniza»).
- No hay error de red separado del error de plantilla ni del error de envío.

### 3.5 Ajustes — `/ajustes` — `src/pages/SettingsPage.tsx`

**Estados que existen**
- Cabecera «Ajustes» / «Cuenta, conexión y preferencias.».
- «Conexión» (pista «Cuenta»): cargando «Comprobando la conexión…»; error con el mensaje de la API + «Reintentar»; vinculada, insignia «Vinculado» + `{garmin_email}` o «Cuenta»; reautenticación pendiente «Vuelve a vincular tu cuenta para seguir sincronizando.»; botones «Sincronizar ahora» / «Sincronizando…» y «Cambiar cuenta».
- Éxito de sincronización: caja verde con `{syncNow.data.message}` (mensaje del backend). Error de sincronización: `{syncNow.error.message}`.
- Sin vincular: «Conecta tu cuenta para ver tu actividad y tu recuperación.» + botón «Vincular cuenta».
- Formulario «Vincular cuenta»: subtítulo «No guardamos tu contraseña.», campos «Correo» y «Contraseña», botón «Conectar» / «Vinculando…»; error con `{detail}` de la API o «No se pudo vincular la cuenta.».
- Segundo factor: campo «Código de verificación» (pista «El código de dos pasos.»), botón «Completar vinculación» / «Comprobando…», error `{detail}` o «El código no ha funcionado.».
- Éxito de vinculación: «Cuenta vinculada. No guardamos tu contraseña.» (sustituye al formulario).
- «Apariencia»: botones «Oscuro» y «Claro» (pulsados con `aria-pressed`).
- «Secciones»: casilla «Mostrar todas las secciones» con pista «Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social.».
- «Cuenta»: «Nombre» / `{display_name}` o «sin nombre»; «Correo» / `{email}` o «sin correo»; botón «Cerrar sesión».

**Estados que NO existen**
- No hay confirmación de cierre de sesión (se cierra y vuelve al login).
- No hay estado de carga/éxito para el tema ni para la casilla de secciones (son instantáneos, sin acuse).
- No hay pantalla de «cuenta borrada» (existe `forgetSession` en el contexto de auth pero ninguna pantalla lo usa).

### 3.6 Actividades — `/actividades` — `src/pages/extended/ActivitiesPage.tsx` (`extended`)

**Estados que existen**
- Cabecera «Actividades» / «Tu historial y el detalle de cada salida.».
- Filtros siempre visibles: «Buscar» (marcador «Nombre de la actividad»), «Desde», «Hasta», botones «Últimos 30 días» y «Este mes», grupo «Deporte» con «Todas», «Carrera», «Bici», «Fuerza», «Fútbol», «Natación» y enlace «Quitar filtros» (solo si hay algún filtro).
- Rango inválido: «La fecha Desde no puede ser posterior a Hasta.».
- Cargando «Cargando actividades»; error «No se pudieron cargar las actividades.» + «Reintentar».
- Vacío con filtros: «Sin actividades con esos filtros» / «Prueba otro deporte, cambia las fechas o borra la búsqueda.» + botón «Quitar filtros».
- Vacío sin filtros: «Todavía no hay actividades» / «Cuando sincronices o registres un entrenamiento, aparecerá aquí.».
- Lista: «{n} actividad» / «{n} actividades»; tarjeta con nombre, fecha, «{deporte} · {duración}», distancia en km, «{n} lpm media», «{n} m desnivel», «esfuerzo {n}».
- Paginación: botón «Ver más actividades» (cuando el número devuelto iguala el límite y el límite es menor que 200).

**Estados que NO existen**
- **No existe un estado de «cargando más»**: al subir el límite cambia la clave de la consulta y la pantalla pasa por el esqueleto completo, sustituyendo la lista ya cargada (`ActivitiesPage.tsx:141` + `:194-199`).
- No hay estado de éxito ni de error propio del filtrado (los errores son de la consulta).
- No hay filtros plegados: ver §6.3.

### 3.7 Actividad (detalle) — `/actividades/:id` — `src/pages/extended/ActivityDetailPage.tsx` (`extended`)

**Estados que existen**
- Cargando: esqueleto «Cargando la actividad» (sin cabecera).
- Error: cabecera «Actividad» + «No se pudo cargar la actividad.» + «Reintentar».
- Con datos: cabecera con el nombre de la actividad (o el tipo), descripción «{tipo} · {fecha y hora}» y acción «Actividades».
- Tarjetas de métricas (solo si el dato existe): «Distancia», «Duración», «Ritmo», «FC media», «FC máx.», «Cadencia», «Potencia», «Desnivel», «Bajada», «Altitud», «Calorías», «Zancada», «Desnivel/zancada», «Oscilación», «Contacto», «Temperatura media», «Sudor», «Carga».
- Secciones condicionales: «Zonas de FC»; «Vueltas» (pista «{n} vueltas»); «Meteo» (Temperatura, Sensación, Viento, Humedad); «Recorrido», «Frecuencia cardiaca», «Ritmo», «Altitud», «Velocidad», «Cadencia», «Potencia», «Temperatura», «Parciales» (pista «cada kilómetro»).
- Estados internos de cada sección: «Cargando recorrido…», «Sin recorrido guardado.», «Cargando…», «Sin series de FC.», «Sin series de ritmo.», «Sin series de altitud.», «Sin series de velocidad.», «Sin parciales para este deporte.», «Cargando parciales…», «Sin parciales.».
- Sin GPS: tarjeta «Series» + vacío «Sin recorrido» / «Esta actividad no tiene GPS ni series que dibujar.».
- Vacíos de gráfica: «Sin zonas de FC para esta actividad.», «Sin vueltas registradas.», «Sin parciales por kilómetro.».

**Estados que NO existen**
- No hay estado «actividad sin permiso» ni 404 de actividad (un id inexistente cae en el error genérico).
- Las secciones de gráficas no ofrecen reintento individual: si fallan, muestran el aviso en gris pequeño sin botón.

### 3.8 Calendario — `/calendario` — `src/pages/extended/CalendarPage.tsx` (`extended`)

**Estados que existen**
- Cargando «Cargando el calendario»; error «No se pudo cargar el calendario.» + «Reintentar» (**sin cabecera de página** en la rama de error).
- Con datos: cabecera «Calendario» / «Tu semana de entrenamiento.».
- «Programar entrenamiento» (pista «Semanal o un día concreto»); sin plantillas «Todavía no hay plantillas. Crea una en Gimnasio para programarla.».
- Selector «Plantilla» con opción «Elige una plantilla»; modo «Se repite cada semana» / «Un día concreto»; «Días» (lun-dom en tres letras), «Día», «Hora», «Repetir hasta (opcional)»; botón «Programar» / «Guardando…».
- Éxito: «Entrenamiento semanal guardado. Se enviará solo al reloj los próximos días.» o «Entrenamiento guardado para ese día.».
- Error al guardar: «No se pudo guardar el entrenamiento.» — **pero se pinta con el estilo de éxito (texto verde)**; ver §6.4.
- «Tus entrenamientos semanales» (pista «{n} programados»): vacío «Todavía no has programado ninguno.»; por entrenamiento: «{día} · {plantilla}», hora, «Hasta {fecha}», botones «Previsualizar», «Quitar todo», campo «Desde» y «Quitar desde aquí».
- Previsualización de envío: «Preparando…», «No se pudo preparar el envío.», «{n} ejercicio(s) · ~{n} min», error «No se pueden enviar: {ejercicios}.», botones «Enviar al reloj» / «Enviando…» y «Cerrar»; éxito «Enviado al reloj.» / error «No se pudo enviar.» (también en verde).
- «Auto-carga en el reloj» (pista «Automático») con el texto «Cada mañana se envía solo el entreno de hoy y de los próximos días. Tú solo pulsas empezar en el reloj.» y botón «Preparar los próximos 7 días» / «Enviando…»; mensajes «Vincula tu cuenta para enviar entrenos al reloj.», «Entrenos de hoy y próximos días enviados.», `{result.message}` o «No hay entrenamientos pendientes.», «No se pudo enviar.».
- «Tu semana» (pista «7 días»): 7 tarjetas con «{día} {inicial}», «Listo» / «Cuidado» / «Descansa», «Libre» o «{n} plan» / «{n} hecho»; pie «Hoy tienes plan: se envía solo al reloj.».

**Estados que NO existen**
- No hay confirmación al borrar («Quitar todo» y «Quitar desde aquí» actúan al primer toque).
- No hay estado vacío de la semana (siempre pinta 7 tarjetas).
- No hay distinción visual entre éxito y error en los mensajes de la tarjeta (siempre verde).

### 3.9 Tendencias — `/tendencias` — `src/pages/extended/TrendsPage.tsx` (`extended`)

**Estados que existen**
- Cabecera «Tendencias» / «Tu evolución, tu carga y tu gimnasio.» con periodo «7 d», «30 d», «90 d», «Año».
- «Métrica» (pista «{n} días») con «HRV», «Sueño (h)», «Sueño (score)», «FC en reposo», «Body Battery», «Estrés»; cargando «Cargando la tendencia»; error «No se pudo cargar la tendencia.» + «Reintentar»; vacío «Sin datos para esta métrica» / «No hay valores en este periodo.»; con menos de dos puntos «Menos de dos puntos en la ventana: no se dibuja una tendencia que no existe.».
- «Carga de entrenamiento»: «Cargando la carga…», «No se pudo cargar la carga.»; «Carga semanal» («Cada semana»): «Cargando la carga semanal…», «No se pudo cargar la carga semanal.», «Carga semanal {n}», «Variación {n}» o «sin dato»; vacío «Sin carga semanal en el periodo: las barras aparecerán cuando haya actividades o sesiones.».
- «Calendario de actividad»: «Cargando el calendario…», «No se pudo cargar el calendario.», vacío «Faltan días para dibujar el calendario.».
- «Fases de sueño»: «Cargando las fases de sueño…», «No se pudieron cargar las fases de sueño.», «Solo noches con datos.», vacío «Sin noches con fases de sueño reales en el periodo: no se dibuja una noche plana.».
- «Peso × repeticiones» («Cada punto, una serie»): «Cargando…», «No se pudo cargar la dispersión.», vacío «Faltan series de trabajo para dibujar la dispersión: hacen falta al menos tres.».
- «Volumen por grupo muscular» (pista «{n} sesión/sesiones»): «Cargando el gimnasio…», «No se pudo cargar el gimnasio.», «{kg} totales», «{n} series», «{n} repeticiones», «Sin periodo anterior comparable.» o «{±n} % de peso movido que antes.», vacío «Sin series de trabajo en el periodo: no hay volumen que repartir por grupo muscular.».
- «Empuje / tirón» («Por grupo principal»): «Cargando el reparto…», «No se pudo cargar el reparto.», vacío «Sin volumen clasificado de empuje o tirón en el periodo.», pie «{n} de empuje por cada 1 de tirón» o «sin tirón registrado»; «Top ejercicios» y «Sin ejercicios en el periodo.».

**Estados que NO existen**
- No hay un estado global de pantalla: cada tarjeta gestiona su carga/error por separado (hasta 8 estados distintos en la misma pantalla).
- No hay explicación del heatmap ni leyenda de intensidad (solo `aria-label`).

### 3.10 Rendimiento — `/rendimiento` — `src/pages/extended/PerformancePage.tsx` (`extended`)

**Estados que existen**
- Cabecera «Rendimiento» / «Tu progreso y tus mejores marcas.».
- Cargando «Cargando rendimiento» (sustituye a todo el cuerpo); error «No se pudo cargar el rendimiento.» + «Reintentar».
- «Resumen» («Últimos 30 días»): «Sesiones», «Horas» («h»), «Carga» («Lo entrenado.»), cada una con pie «Antes: {n}».
- «Zonas de FC» («30 días», «Tiempo en cada zona.»): vacío «Sin tiempo registrado en zonas.».
- «Marcas»: vacío «Sin marcas todavía» / «Tus mejores marcas aparecerán al sincronizar tus entrenamientos.».

**Estados que NO existen**
- No hay estado de error por tarjeta (cualquier fallo tira la pantalla entera).
- No hay rango de fechas seleccionable (fijo a 30 días).

### 3.11 Rutas — `/rutas` — `src/pages/extended/RoutesPage.tsx` (`extended`)

**Estados que existen**
- Cabecera «Rutas» / «Genera recorridos con pasos, desnivel y ritmo por kilómetro.».
- «Nueva ruta» («Diseño de la salida»): «Nombre» («Ruta del domingo» por defecto), «Deporte» (Carrera, Bici, Senderismo), «Kilómetros» (8 por defecto), «Esfuerzo» (Suave, Medio, Fuerte), «Volver al inicio», «Puntos de paso» con «Latitud {i}», «Longitud {i}», «Altitud {i}», botones «Añadir paso», «Quitar último paso» y «Generar ruta» / «Generando…»; error «No se pudo generar la ruta.».
- Ruta generada: cabecera con nombre y pista «{km} · {m} desnivel», mapa, perfil, «Duración», «Esfuerzo», «Perfil», botón «Descargar GPX para el reloj» y enlace «Ver ritmo por kilómetro».
- Cargando ruta «Cargando la ruta»; error «No se pudo cargar la ruta.».
- «Tus rutas» (pista «{n} guardadas»): «Cargando rutas», «No se pudieron cargar las rutas.», vacío «Todavía no hay rutas» / «Genera una arriba y quedará guardada aquí.».
- «Ritmo por kilómetro» («calculado de la ruta») con tabla «Km», «Ritmo», «Desnivel».

**Estados que NO existen**
- No hay éxito explícito al generar (aparece la tarjeta y ya).
- No hay error de descarga de GPX (el `fetch` retorna sin mensaje si falla, `RoutesPage.tsx:112-126`).
- No hay vacío con datos a medias (si el mapa no tiene puntos, dibuja el perfil vacío).

### 3.12 Social — `/social` — `src/pages/extended/SocialPage.tsx` (`extended`)

- Cabecera «Social» / «Compara tu semana con la de tus amigos.».
- Cargando «Cargando la clasificación»; error «No se pudo cargar la clasificación.» + «Reintentar»; vacío «Aún no hay clasificación» / «La clasificación compara la carga semanal: lo que cada uno ha entrenado. Añade amigos y entrena para aparecer.».
- Lista: puesto, nombre, «{n} actividades», «{n}» y «carga».
- **No existe** acción para añadir amigos ni para compartir (el vacío lo sugiere pero no hay control).

### 3.13 Sección no disponible — `src/pages/extended/UnavailablePage.tsx` (`extended` apagado)

- Cabecera «Sección no disponible» / «Actívala para verla.».
- Cuerpo «Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social se activan desde Ajustes.» + enlace «Ir a Ajustes».
- **No existe** un botón que active la bandera en el sitio (hay que ir a Ajustes y marcar la casilla).

### 3.14 Entrenar — `/gimnasio/entrenar` — `src/pages/SessionPage.tsx`

**Estados que existen**
- Sin plantilla (sin `?template=`): cabecera «Entrenar» / «Elige una plantilla para empezar la sesión.» + vacío «Sin plantilla seleccionada» / «Abre una plantilla desde Gimnasio y pulsa Empezar.» + enlace «Ir a Gimnasio».
- Cargando: «Entrenar» / «Preparando la sesión…» + esqueleto «Cargando la plantilla y las últimas marcas»; después, «Preparando la sesión» (sin cabecera).
- Error: «Entrenar» / «No se pudo abrir la plantilla.» + mensaje de la API + «Reintentar».
- Sesión en curso: cabecera «Entrenar» / «{plantilla} · {m}:{ss} · {n} serie hecha / {n} series hechas»; acciones «Descartar» (rojo) y «Terminar sesión» / «Guardando…».
- Descanso: barra «Descanso» con `{m}:{ss}`, «Sigue aunque bloquees el móvil»; al llegar a cero «Listo» y «Puedes empezar la siguiente serie».
- Tarjeta por ejercicio: nombre, insignia «{hechas}/{total} series», «Objetivo {sets}×{reps} · descanso {n}s · Anterior: {kg} × {reps}» o «· sin marca anterior», ilustración «Inicio»/«Fin», columnas «Serie», «Peso (kg)», «Reps», «Esfuerzo», «Hecha», y una casilla por serie (accesible: «Serie {n} de {ejercicio}»).
- Descarte: tarjeta roja «¿Descartar esta sesión? No se guardará.» con «Sí, descartar» y «Seguir entrenando».
- Error al terminar: «Marca al menos una serie con peso y repeticiones antes de terminar.» (validación local) o el mensaje del backend.
- Resumen (tras guardar): cabecera «Sesión terminada» / `{nombre}` o «Sesión de fuerza», acciones «Editar pesos reales» y «Volver a Gimnasio»; tarjetas «Peso movido» y «Series»; «Reparto muscular» (o «Sin series de trabajo: no hay volumen que repartir.»); «Series registradas» con «Serie {n}» y «{kg} × {reps} · esfuerzo {rpe}»; pie «Guardada en tu historial.».
- Duplicado: el mismo par de acciones aparece otra vez al final de la página («Descartar sesión» y «Terminar sesión»).

**Estados que NO existen**
- **No hay confirmación al terminar la sesión**: «Terminar sesión» guarda y cierra al primer toque; «Descartar», que no guarda, sí pide confirmación (asimetría).
- No hay estado «sin conexión, borrador guardado» (el borrador existe en `localStorage` pero no se comunica en pantalla).
- No hay navegación de salida sin descartar ni terminar (solo la barra inferior, ver §6.2).
- No hay aviso de que el reloj esté detectando repeticiones (si la detección está activa) durante la sesión.

### 3.15 Detección de repeticiones — `/gimnasio/ejercicios/:id/deteccion` — `src/pages/MotionProfilePage.tsx`

- Cargando «Cargando la detección» (sin cabecera); error «No se pudo cargar el ejercicio.» o «No se pudo cargar la configuración.» + «Reintentar».
- Cabecera «Detección de repeticiones» / `{ejercicio}` y acción «Catálogo».
- «Detección automática» (pista «Activa» / «Sin activar») con el párrafo «Cuando empiezas la serie, el reloj detecta el movimiento: marca el inicio y el final de cada repetición, mide la velocidad y estima la fuerza. No tienes que configurar duraciones.».
- Inactiva: botón «Activar detección automática» / «Activando…»; éxito «Detección activada.»; error «No se pudo activar. Inténtalo otra vez.».
- Activa: botón «Desactivar» / «Desactivando…» y nota «La estimación se verá al terminar la serie.».
- «Ajuste fino» con desplegable «Solo si el reloj no te cuenta bien», párrafo «La mayoría de ejercicios funcionan con la detección automática. Cambia esto solo si faltan o sobran repeticiones.», selectores «Movimiento» (Arriba y abajo, Lateral, Frontal) y «Sensibilidad» (Suave, Normal, Alta) y botón «Guardar ajuste».
- «Estado»: activa «Activa en tu cuenta. El reloj contará la serie y te dará la estimación de fuerza.»; inactiva vacío «Conteo manual» / «Mientras no la actives, las series se marcan a mano en la sesión.».
- **No existen** estados intermedios de calibración ni error específico al desactivar (el botón no muestra error).
- Detalle: estando activa y con `saved` a la vez, se muestran «Desactivar» **y** «Activar detección automática» (`MotionProfilePage.tsx:110-126`).

### 3.16 Editar pesos reales — `/gimnasio/sesiones/:id` — `src/pages/SessionEditPage.tsx`

- Cargando «Cargando la sesión» (sin cabecera); error cabecera «Editar sesión» + «No se pudo cargar la sesión.» + «Reintentar».
- Cabecera «Editar pesos reales» / «{sesión} · {fecha}» y acción «Gimnasio».
- Texto «Ajusta el peso real con − o +. Se guarda solo y recalcula el total.» (en la captura antigua 20 este texto y el botón no coinciden: ver §5.3).
- Filas: nombre del ejercicio + «Serie {n}» + etiqueta «Revisar» si `needs_review`, botones − / +, peso grande, «× {reps}».
- Guardado: «Guardando…» / «Guardado.»; reposo «Toca − o + para cambiar una serie.»; error «No se pudo guardar.».
- **No existe** botón de guardar (autoguardado) ni confirmación al salir.

### 3.17 Editar pesos (plantilla) — `/gimnasio/plantillas/:id` — `src/pages/PlanEditorPage.tsx`

- Cargando «Cargando el plan» (sin cabecera); error cabecera «Editar plan» + «No se pudo cargar el plan.» + «Reintentar».
- Cabecera «Editar pesos» / «{plantilla} · toca − o + en cada serie» y acción «Gimnasio».
- Estado de guardado: «Guardando…» / «Guardado a las {hora}» / «Los cambios se guardan solos.».
- Por ejercicio: título y pista «{sets} × {reps}», filas «Serie {n}» con botones − / + y el peso.
- Error «No se pudo guardar. Prueba otra vez.».
- **No existe** estado de éxito persistente ni de error por serie; tampoco hay forma de volver atrás sin guardar.

### 3.18 Catálogo — `/gimnasio/catalogo` — `src/pages/extended/CatalogPage.tsx` (siempre disponible)

- Cabecera «Catálogo» / «Ejercicios disponibles, con su dibujo de inicio y fin de movimiento.» y acción «Volver a Gimnasio».
- Filtros: «Buscar» (marcador «Press, sentadilla, remo…») y «Grupo muscular» con opción «Todos».
- Cargando «Cargando el catálogo»; error `{mensaje de la API}` + «Reintentar»; vacío «Sin resultados» / «No hay ejercicios que coincidan con la búsqueda. Prueba otro término.».
- Tarjeta: nombre, grupo muscular a la derecha, ilustración «Inicio»/«Fin», equipo, sufijos «· por tiempo» y «· unilateral», notas y enlace «Configurar detección».
- **No existe** paginación ni contador de resultados: se listan todos los ejercicios que devuelve la consulta (`useExercises` no recibe límite).

### 3.19 Biblioteca — `/gimnasio/biblioteca` — `src/pages/extended/LibraryPage.tsx` (siempre disponible)

- Cargando «Cargando la biblioteca» (sin cabecera); error «No se pudo cargar la biblioteca.» (sin cabecera).
- Cabecera «Biblioteca» / «Rutinas ordenadas por foco y fase, con series, peso y descanso.» y acción «Gimnasio».
- Vacío sin rutinas: «Sin rutinas» / «Cuando crees una plantilla, aquí aparecerá ordenada por foco.».
- Filtro «Filtrar por foco» con «Todos» y etiquetas «Empuje», «Tirón», «Pierna», «Cuerpo completo»; vacío de filtro «Sin rutinas de ese foco» / «Prueba otro foco o vuelve a Todos.».
- Lista: nombre, «{día} · {n} ejercicios» o «Sin día fijo», insignia de foco («General» si no hay), «{n} series · {kg} de volumen».
- Detalle sin selección: «Elige una rutina» / «Verás sus fases, el peso y las repeticiones de cada ejercicio.».
- Detalle: «Cargando la rutina»; error «No se pudo cargar la rutina.»; pista «{día}», «{n} ejercicios · {n} series · {n} min aprox.»; fases «Activación» («Prepara la articulación y el patrón.»), «Bloque principal» («Series de trabajo con el peso indicado.»), «Cierre» («Termina con control y sin prisa.»); por ejercicio «{sets} × {reps} · {kg} kg», «Serie {n}», «{kg} × {reps}» o «corporal × {reps}», «Volumen {kg} · descanso {n}s · {equipo} · {notas}»; acciones «Empezar esta sesión» y «Ver ejercicios».
- **No existe** estado de error de la selección dentro de la lista (sustituye el panel derecho/abajo por el error) ni «seleccionado» persistente al recargar.

### 3.20 Página no encontrada — `*` — `src/App.tsx:58-67`

- «Página no encontrada» / «Esa dirección no existe en esta app.» + enlace «Volver a Hoy».
- **No existe** búsqueda ni listado de secciones en el 404.

---

## 4. Navegación

### 4.1 Cómo se mueve el usuario

- **Marco común (`src/components/AppShell.tsx`).** En escritorio (`min-width: 1024px`): barra lateral fija de 3 acciones + grupo «Ampliado» (si la bandera está encendida) + ficha de usuario abajo. En móvil: cabecera superior fija con la marca «Lyfta Entrena» y **barra inferior fija de 3 pestañas** («Hoy», «Gimnasio», «Ajustes»), con icono y etiqueta de 12 px, alto mínimo 44 px y respeto del `safe-area-inset-bottom`.
- **Secciones extendidas.** Con la bandera encendida aparece, **en todas las pantallas y solo en móvil**, una fila horizontal desplazable de 6 chips («Actividades», «Calendario», «Tendencias», «Rendimiento», «Rutas», «Social») justo debajo de la cabecera (`AppShell.tsx:100-125`). Con la bandera apagada, esa fila no se pinta.
- **Descubrimiento del modo extendido.** En escritorio, cuando está apagado, la barra lateral explica «Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social se encienden en Ajustes.» (`AppShell.tsx:82-86`). **En móvil ese aviso no existe**: si la bandera está apagada no hay ni rastro de las secciones; para llegar la primera vez hay que ir a Ajustes → marcar «Mostrar todas las secciones» → volver → pulsar el chip (3–4 toques, y hay que saber que existen).
- **Rutas anidadas.** `AppShell` es una ruta de layout con `<Outlet />`; los detalles cuelgan como rutas hermanas (`gimnasio/plantillas/:id`, `gimnasio/sesiones/:id`, `gimnasio/ejercicios/:id/deteccion`, `gimnasio/entrenar`, `actividades/:id`). No hay rutas hijas de lista en el router: la relación es visual, no jerárquica.
- **Vuelta atrás.** No hay botón «atrás» ni chevron en las cabeceras. Cada pantalla secundaria lleva un enlace de texto: «Gimnasio» (Editar pesos, Editar pesos reales), «Volver a Gimnasio» (Catálogo), «Catálogo» (Detección), «Actividades» (detalle), «Gimnasio» (Biblioteca), «Volver a Hoy» (404). En la pantalla de sesión no hay vuelta atrás: solo «Descartar»/«Terminar» o la pestaña inferior.
- **Doble navegación simultánea.** Con la bandera encendida coexisten dos navegaciones globales (3 pestañas abajo + 6 chips arriba) en todas las pantallas, incluidas Ajustes y las propias secciones extendidas.

### 4.2 Pantallas que quedan a dos o más toques (desde Hoy, móvil)

| Destino | Toques | Camino |
|---|---|---|
| Gimnasio | 1 | Pestaña «Gimnasio» |
| Empezar la sesión de hoy | 2 | Gimnasio → «Empezar sesión» |
| Biblioteca | 2 | Gimnasio → «Biblioteca» |
| Catálogo | 2 | Gimnasio → «Catálogo» |
| Editar pesos de una plantilla | 2 + desplazamiento | Gimnasio → «Pesos» (hay que llegar a la lista de plantillas) |
| Corregir pesos de una sesión | 2 + desplazamiento | Gimnasio → «Corregir pesos» |
| Detección de un ejercicio | 3 | Gimnasio → «Catálogo» → «Configurar detección» |
| Actividad (detalle) | 2 | chip «Actividades» → tarjeta |
| Actividad, Calendario, Tendencias, Rendimiento, Rutas o Social **con la bandera apagada** | 3–4 y sin pistas | Ajustes → casilla «Mostrar todas las secciones» → volver → chip |
| Resumen de la sesión | depende | solo se llega terminando una sesión; después, «Volver a Gimnasio» (1) |

Y en sentido inverso: desde una pantalla extendida se vuelve a Gimnasio con 1 toque (pestaña), pero **no** hay chip de «Gimnasio» en la fila superior.

---

## 5. Capturas

### 5.1 Cómo están hechas

Todas viven en `frontend-nuevo/screenshots/` (y 4 en `screenshots/visual-baseline/`). Son capturas de página completa a **780 px de ancho** (390 CSS con DPR 2) salvo tres (01, 02 y 10) que miden 780×1688 = viewport de 390×844 CSS. Las páginas largas miden hasta 780×5600. **Ojo:** la barra inferior es `position: fixed`; en las capturas de página completa aparece **superpuesta en mitad del contenido** (03, 21, 05, 16…) — es un artefacto de la captura, no un fallo de la app. Dos ficheros con extensión `.png` contienen en realidad JPEG (16 y 18).

### 5.2 Tabla de capturas (33 ficheros, 27 estados distintos)

| Fichero | Tamaño (px) | Pantalla | Estado que muestra | ¿Abierta? |
|---|---|---|---|---|
| `01-login.png` | 780×1688 | Entrar | Inicial, campos vacíos; botón «Entrar» deshabilitado por código | Sí |
| `02-hoy-sin-datos.png` | 780×1688 | Hoy | Vacío por falta de biometría y cuenta sin vincular | Sí |
| `03-gimnasio.png` | 780×2142 | Gimnasio | Con plantilla de hoy («Empuje A»), sin sesiones; sin fila «Estado del envío» (build antiguo) | Sí |
| `04-biblioteca.png` | 780×4000 | Biblioteca | Rutina seleccionada de 1 ejercicio (una sola fase «Bloque principal»), insignia «PUSH», sin chips de foco (build antiguo) | Sí |
| `05-catalogo.png` | 780×4662 | Catálogo | Búsqueda «press» con 7 resultados | Sí |
| `06-deteccion.png` | 780×3200 | Detección | Inactiva: «Sin activar» + estado «Conteo manual» | Sí |
| `07-envio-reloj.png` | 780×2400 | Gimnasio | Envío en estado inicial (no enviado); tampoco tiene fila de estado (build antiguo) | Sí |
| `08-entrenar.png` | 780×4000 | Entrenar | Sesión en curso: 1/4 series hechas, descanso 01:01, dos bloques de acciones | Sí |
| `09-resumen-sesion.png` | 780×4000 | Entrenar (resumen) | Sesión terminada: 320 kg, 1 serie, «Guardada en tu historial.» | Sí |
| `10-actividades.png` | 780×1688 | Actividades | 1 actividad; **sin campos de fecha** (build antiguo) | Sí |
| `11-actividad.png` | 780×4800 | Actividad (detalle) | Carrera de 6,2 km con zonas, vueltas, meteo, recorrido, FC, ritmo y parciales | Sí |
| `12-calendario.png` | 780×4000 | Calendario | Semana programada (domingo) + mensaje de éxito en verde; «Tu semana» con «1 plan / 1 hecho» | Sí |
| `13-tendencias.png` | 780×5200 | Tendencias | HRV a 30 d sin datos; carga semi-vacía; volumen de 1 sesión | Sí |
| `14-ajustes.png` | 780×4000 | Ajustes | Cuenta Garmin sin vincular, tema oscuro, secciones extendidas activadas | Sí |
| `15-rendimiento.png` | 780×3600 | Rendimiento | Todo a cero: 0 sesiones, sin zonas, sin marcas | Sí |
| `16-rutas.png` | 780×5600 (JPEG) | Rutas | Ruta generada de 8 km + 1 ruta guardada + tabla de ritmo | Sí |
| `17-social.png` | 780×3600 | Social | Clasificación con 1 entrada («1 actividades», 6,4 carga) | Sí |
| `18-hoy-escritorio.png` | 2560×1800 (JPEG) | Hoy (escritorio) | Vacío sin biometría; barra lateral con el aviso de secciones apagadas | Sí |
| `19-editar-plan.png` | 780×3200 | Editar pesos | 4 series a 40 kg, auto-guardado («Los cambios se guardan solos.») | Sí |
| `20-editar-sesion.png` | 780×3200 | Editar pesos reales | Build antiguo: botón «Guardar pesos reales» que ya no existe | Sí |
| `21-registro-guardado.png` | 780×1890 | Gimnasio | Mismo estado que 03/07; captura más corta con la barra fija superpuesta | Sí |
| `22-regresion-plan.png` | 780×2400 | Editar pesos | 3 series 40 / 42,5 / 45 kg | Sí (vía baseline) |
| `23-regresion-envio.png` | 780×2400 | Gimnasio | Envío completado: insignia «Enviado» + caja «Enviado al reloj» | Sí (vía baseline) |
| `24-regresion-sesion.png` | 780×2000 | Editar pesos reales | 3 series con autoguardado; texto neutro «Toca − o + para cambiar una serie.» | Sí (vía baseline) |
| `25-biblioteca-fases.png` | 780×4400 | Biblioteca | Rutina de 3 ejercicios con 3 fases y chips de foco | Sí |
| `26-actividades-filtros.png` | 780×3600 | Actividades | 6 actividades + filtros de fecha y presets | Sí |
| `27-flujo-seco-plan.png` | 780×2400 | = 22 | Idéntica byte a byte a 22 | Sí (vía baseline) |
| `28-flujo-seco-envio.png` | 780×2400 | = 23 | Idéntica byte a byte a 23 | Sí (vía baseline) |
| `29-flujo-seco-sesion.png` | 780×2000 | = 24 | Idéntica byte a byte a 24 | Sí (vía baseline) |
| `visual-baseline/envio-enviado.png` | 780×2400 | Gimnasio | **Estado enviado**: insignia «Enviado» + caja verde | Sí |
| `visual-baseline/gimnasio-envio.png` | 780×2400 | Gimnasio | Estado inicial con fila «Estado del envío» e insignia «Pendiente» (build más nuevo que 03/07) | Sí |
| `visual-baseline/plan-pesos.png` | 780×2400 | Editar pesos | = 22 / 27 | Sí |
| `visual-baseline/sesion-guardada.png` | 780×2000 | Editar pesos reales | = 24 / 29 (pese al nombre, muestra el estado neutro, no «Guardado.») | Sí |

### 5.3 Las capturas no son un set coherente (importante para el revisor)

1. **Dos builds como mínimo.** `03`, `07` y `21` muestran la tarjeta «Enviar al reloj» **sin la fila «Estado del envío»**, que el código actual sí pinta (`GymPage.tsx:127-134`); `visual-baseline/gimnasio-envio.png` sí la tiene con «Pendiente» y `envio-enviado.png` con «Enviado».
2. **`10-actividades.png` no tiene filtros de fecha**; `26-actividades-filtros.png` sí, y el código actual los pinta siempre (`ActivitiesPage.tsx:83-115`). Son pantallas distintas de la misma app en momentos distintos.
3. **`20-editar-sesion.png` muestra un botón «Guardar pesos reales»** y el texto «El total y las marcas se recalculan al guardar.»; el código actual autoguarda y dice «Se guarda solo y recalcula el total.» (`SessionEditPage.tsx:100-103`). `24`/`29`/`sesion-guardada` ya son del build nuevo.
4. **`04-biblioteca.png` no tiene chips de foco** y `25-biblioteca-fases.png` sí; el código actual los pinta siempre (`LibraryPage.tsx:79-97`).
5. **La fila de chips extendidos aparece en 10, 11, 12, 13, 14, 15, 16, 17 y 26, y no aparece en 01, 02, 03, 04, 05, 06, 07, 08, 09, 19, 20, 21, 25 ni en ninguna de las 4 de `visual-baseline/`**, así que la bandera `extended` no estaba en el mismo estado en todas las sesiones de captura.
6. **Duplicados exactos** (mismo SHA-256): `22 = 27 = plan-pesos`, `23 = 28 = envio-enviado`, `24 = 29 = sesion-guardada`. Los nombres «regresion-» y «flujo-seco-» no aportan estados nuevos.
7. **Nombres engañosos**: `07-envio-reloj` muestra el estado **antes** de enviar; `24`/`29` se llaman «sesion» pero son la pantalla de editar pesos; `21-registro-guardado` es la misma pantalla que 03/07 (no muestra el resumen guardado).
8. Consecuencia: **las capturas no sirven para comparar píxeles entre sí** ni para verificar que lo que se ve es lo que hay hoy. Sirven para ver la forma y la densidad de cada pantalla.

### 5.4 Qué NO tiene captura (ni una)

- **Ningún estado de error** de ninguna pantalla (la caja «No se han podido cargar los datos» + «Reintentar» no aparece en ninguna captura).
- **Ningún estado de carga** (esqueletos) ni el arranque («Comprobando la sesión») ni el error de arranque.
- **404** («Página no encontrada») y **«Sección no disponible»** (bandera apagada).
- **Login**: aviso de sesión caducada, error de credenciales y estado «Entrando…».
- **Hoy con datos**: no hay ni una captura de la portada con readiness, métricas, gráficas y avisos (solo el vacío). Tampoco del banner «Vuelve a vincular tu cuenta» ni de «Sincronizar ahora».
- **Gimnasio**: error de envío («No se pudo enviar»), «Enviando…», vacío de plantillas, estado sin plantilla asignada al día.
- **Entrenar**: confirmación de descarte, error al terminar, «Guardando…», descanso en «Listo», sesión sin plantilla, error de plantilla. Solo hay una sesión en curso y un resumen.
- **Ajustes**: estado vinculado (insignia «Vinculado»), segundo factor, «Cuenta vinculada. No guardamos tu contraseña.», éxito/error de sincronización y **tema claro** (todas las capturas son oscuras).
- **Actividades**: vacío total, vacío por filtros, error y «Ver más actividades».
- **Actividad**: «Sin recorrido», secciones sin series, error y estado de carga.
- **Calendario**: sin plantillas, modo «Un día concreto», previsualización con ejercicios no enviables y errores.
- **Tendencias/Rendimiento/Rutas/Social**: solo hay una captura de cada una (13, 15, 16 y 17) y todas están con datos a cero o con un único registro; no hay captura de sus estados de carga, de error ni con datos llenos.
- **Escritorio**: solo hay una captura (18, Hoy). Nada de Gimnasio, Entrenar, Actividades ni Ajustes en escritorio.
- **Otras anchuras**: ninguna captura de tablet ni de horizontal; todo es 390 CSS de ancho.

---

## 6. Tres problemas de diseño

Elegidos por impacto en el uso descrito en §1, no por cosmética. Cada uno lleva evidencia, por qué duele y una propuesta pequeña y concreta.

### 6.1 La portada no contiene el entrenamiento del día, y sin biometría es un callejón sin salida

**Qué pasa.** `Hoy` es el destino tras entrar (`LoginPage.tsx:22`, en `navigate('/')`) y la primera pestaña, pero **es un panel de recuperación**: readiness, sueño, HRV, FC, estrés, carga, Body Battery y avisos. No hay ni una línea sobre qué toca entrenar hoy ni un acceso a empezar. Cuando el reloj no está vinculado o no hay biometría, la pantalla entera se reduce a una tarjeta: «Sin datos de hoy» / «Conecta tu cuenta para ver tu disposición.» / «Vincular cuenta», y después unos 400 px CSS de negro hasta la barra inferior.

**Evidencia.**
- Captura `02-hoy-sin-datos.png` (390×844 CSS): la tarjeta de vacío termina a ~344 px; la barra inferior empieza a ~745 px. Hay ~400 px de vacío y **cero** acciones de entrenamiento.
- Captura `18-hoy-escritorio.png`: en escritorio pasa lo mismo; la tarjeta ocupa solo la franja superior de la columna de contenido y quedan ~1.150 px de vacío por debajo (imagen de 2560×1800).
- Código: la rama de vacío termina en `TodayPage.tsx:129-162` y la rama con datos `:167-277`; **ninguna** consulta plantillas ni el entreno del día. El único sitio donde existe «Hoy toca» + «Empezar sesión» es `GymPage.tsx:84-107`.

**Por qué duele en el gimnasio.** El gesto natural entre serie y serie es abrir la app y mirar la portada. Hoy la portada solo tiene sentido si el reloj está vinculado y sincronizado; en el caso más común al empezar (recién instalada, cuenta sin vincular, o un día sin sincronizar) el atleta abre la app y no encuentra ni el entreno ni un botón para empezarlo: tiene que descubrir que el entreno vive en otra pestaña. Y aunque esté vinculado, la portada no responde a la pregunta que importa en ese momento («¿qué me toca?»), sino a una pregunta de sobremesa («¿cómo he dormido?»).

**Propuesta (pequeña).** Añadir en `Hoy`, por encima de «Disposición», una tarjeta que reutilice lo que ya existe en `GymPage`: «Hoy toca» + nombre de la plantilla + «{n} ejercicios · {n} series · {kg}» + botón «Empezar sesión» (enlaza a `/gimnasio/entrenar?template=<id>`). Si no hay plantilla asignada: «Hoy no toca entreno · Ver plantillas» enlazando a `/gimnasio`. Se puede hacer con `useTemplates()` sin tocar el backend, y **debe** pintarse también dentro de la rama de vacío (sustituyendo parte del negro), porque es justo el caso en que más falta hace.

### 6.2 La pantalla de entrenar no es una pantalla de foco: pestañas activas y acciones peligrosas en la zona del pulgar

**Qué pasa.** `Entrenar` es una ruta hija de `AppShell` (`App.tsx:98`), así que conserva la cabecera de marca y la **barra inferior de 3 pestañas** (`AppShell.tsx:132-141`, `position: fixed`). En la misma pantalla hay **dos filas de acciones idénticas**: «Descartar» (rojo) + «Terminar sesión» en la cabecera y «Descartar sesión» + «Terminar sesión» al final (`SessionPage.tsx:436-454` y `:570-578`). «Terminar sesión» guarda y cierra **sin confirmación**; «Descartar», que no guarda nada, **sí** pide confirmación (`:456-477`). El botón de terminar está además activo y en cian desde el primer segundo en que hay una serie marcada.

**Evidencia.**
- Captura `08-entrenar.png`: cabecera con «Descartar» (rojo) y «Terminar sesión» (cian) visibles antes del temporizador de descanso; al final de la página, la misma pareja otra vez; la barra «Hoy · Gimnasio · Ajustes» se ve al pie.
- Código: `AppShell.tsx:132-141` (la barra se pinta siempre en móvil, sin condición de ruta) y `SessionPage.tsx:449-451` (terminar, sin confirmación) frente a `:456-477` (descartar, con confirmación).
- La barra mide 44 px de alto mínimo por pestaña y está fija abajo: es exactamente donde reposa el pulgar cuando se sujeta el móvil con una mano.

**Por qué duele en el gimnasio.** Estás de pie, con una mano, el móvil en la mano libre o apoyado en la máquina, y toda la interacción real es marcar la casilla «Hecha» de la serie. Justo en el borde inferior, a un toque y sin confirmación, hay tres destinos que abandonan la sesión: «Hoy», «Gimnasio», «Ajustes». Un roce cambia de pantalla y te deja sin temporizador de descanso a la vista (el borrador se conserva, pero tú no lo sabes). Y en la parte superior, el rojo «Descartar» compite en peso visual con «Terminar sesión»: dos acciones destructivas/irreversibles en los dos extremos opuestos. Que «Terminar» no pida confirmación mientras «Descartar» sí es exactamente al revés de lo que el riesgo sugiere: terminar es lo que se pulsa cansado, y guarda una sesión incompleta sin vuelta atrás.

**Propuesta (pequeña).** Declarar `Entrenar` como pantalla de foco: en `AppShell`, ocultar cabecera y barra inferior cuando `location.pathname` empieza por `/gimnasio/entrenar` (una condición y un `return` de layout alternativo). En `SessionPage`, quedarse con **una sola** barra de acción fija abajo con «Terminar sesión» y un botón «⋯» que abra «Descartar sesión»; pedir confirmación a terminar solo si `doneCount < total de series` (o siempre, con el resumen de lo que se guarda). Se elimina la fila duplicada de arriba y la acción destructiva deja de estar en el pulgar.

### 6.3 Los filtros de Actividades están siempre abiertos y empujan la lista fuera de la primera pantalla

**Qué pasa.** En `Actividades` el bloque de filtros se pinta **siempre** y completo: buscador, «Desde», «Hasta», dos presets de fecha, seis chips de deporte en dos filas y «Quitar filtros». La lista de actividades —que es el contenido— empieza después de todo eso. En la captura, la primera tarjeta arranca a ~490 px CSS y el bloque de filtros ocupa ~280 px CSS, un tercio del alto de un iPhone 13.

**Evidencia.**
- Captura `26-actividades-filtros.png` (390×1800 CSS de página): «Buscar» empieza a ~167 px, «Quitar filtros» acaba a ~450 px, la primera tarjeta de actividad a ~490 px. Con un viewport de 844 px solo caben dos tarjetas, y para ver las seis hay que desplazarse varias pantallas.
- Código: `ActivitiesPage.tsx:73-139` — el `<section aria-label="Filtros">` no tiene estado de plegado; los controles de fecha (`:83-115`) y los chips (`:116-127`) se renderizan siempre.
- Contraste con el estado de la captura `10-actividades.png` (build antiguo): sin fechas ni presets, la lista empezaba mucho antes. La regresión de densidad es reciente.

**Por qué duele.** La tarea dominante de esa pantalla es «ver las últimas actividades» (lo que acabas de entrenar), y el caso raro es filtrar por deporte y rango de fechas. La pantalla está optimizada para el caso raro: el usuario paga ~280 px de controles y un desplazamiento para llegar a una tarjeta. Además los dos presets («Últimos 30 días», «Este mes») duplican controles que ya se pueden poner a mano, y los seis chips de deporte ocupan dos filas con «Todas» como opción por defecto. Con una mano y el móvil en el gimnasio, es scroll puro.

**Propuesta (pequeña).** Colapsar el bloque: dejar siempre visibles solo el buscador y **una** fila de deporte con desplazamiento horizontal (o un desplegable «Deporte ▾»); mover «Desde/Hasta», los presets y «Quitar filtros» a un panel que se abre con un botón «Filtros» que muestra el número de filtros activos («Filtros (2)»). Mantener «Quitar filtros» también dentro del panel y como acción del estado vacío. Es un cambio contenido en `ActivitiesPage.tsx`, sin tocar consultas (`useActivities` ya recibe los mismos parámetros), y devuelve el contenido a la primera pantalla.

### 6.4 Otros hallazgos que no forman parte de los tres (pero que el revisor debería ver)

- **Error pintado como éxito en Calendario.** Los mensajes de la tarjeta de programación usan siempre el estilo verde (`role="status"` + `text-success`), incluidos «No se pudo guardar el entrenamiento.» y «No se pudo enviar.» (`CalendarPage.tsx:117`, `:193`, `:279`). En `12-calendario.png` el mensaje visible es el de éxito, en verde; el de error usa exactamente la misma clase, así que un fallo de guardado se leería como confirmación.
- **El resultado del envío al reloj no se persiste.** La insignia «Enviado»/«Pendiente» viene de una mutación en memoria (`usePushWorkout`, `GymPage.tsx:19`), no de una consulta ni de `localStorage`: al desmontar Gimnasio y volver, el estado de la mutación se pierde y la insignia vuelve a «Pendiente» aunque el entreno se enviara. Comparar `visual-baseline/gimnasio-envio.png` (Pendiente) con `envio-enviado.png` (Enviado): la misma pantalla con dos estados que el usuario no puede volver a consultar.
- **«Ver más actividades» borra la lista.** Al subir el límite cambia la clave de la consulta y la rama `activities.isPending` pinta el esqueleto completo, sustituyendo las tarjetas ya cargadas (`ActivitiesPage.tsx:141` y `:194-199`). No hay estado de «cargando más» ni conservación de la posición.
- **Textos por debajo del token tipográfico.** La tira «Tu semana» del Calendario usa 10 px y 9 px (`CalendarPage.tsx:293`, `:295`, `:299`, `:303`, `:309`) cuando el token de texto más pequeño es 12 px (`--text-caption`). En la captura `12-calendario.png` se lee «1 plan / 1 hecho» a 9 px en celdas de ~44 px de ancho, y las celdas no son pulsables: información que no se puede leer ni usar.
- **Títulos que desaparecen al cargar/fallar.** Unas pantallas conservan la cabecera en carga/error (Actividades, Tendencias, Entrenar, Rutas) y otras la pierden (Biblioteca, Calendario, Editar pesos, Detectar, detalle de actividad), así que el layout salta y el usuario pierde la referencia de dónde está. Ejemplos: `CalendarPage.tsx:48-61` (error sin `PageHeader`) frente a `ActivitiesPage.tsx:141-145` (con cabecera).
- **Plurales sin concordancia.** «1 ejercicios» (`GymPage.tsx:91`, visible en 03/07/21 y en `visual-baseline/gimnasio-envio.png`), «1 actividades» (`SocialPage.tsx:32`, visible en 17), «1 guardadas» (`RoutesPage.tsx:223`, visible en 16), «1 ejercicios» en Biblioteca (`LibraryPage.tsx:110-111`, visible en 04/25). La app sí concuerda en otros sitios («1 serie hecha», «1 actividad»), así que el fallo es inconsistente.
- **`StatCard` desalinea la fila cuando una tarjeta lleva `hint`.** En Rendimiento la tarjeta «Carga» lleva `hint` y las otras dos no, así que su número queda más abajo que los de «Sesiones» y «Horas» (`PerformancePage.tsx:29-31` y `ui.tsx:110-125`). Visible en 15-rendimiento.png.
- **Cifras que no cuadran en el detalle de actividad.** En `11-actividad.png`, la tarjeta de métricas dice «DESNIVEL 81 m» y el pie del recorrido dice «desnivel 0 m»; el mismo dato con dos valores en la misma pantalla.
- **Lista y detalle duplicados en móvil (Biblioteca).** El maestro-detalle usa `lg:grid-cols-[…]` (`LibraryPage.tsx:77`): en móvil se apilan la tarjeta de la lista y la tarjeta de detalle, que repite título y «{n} ejercicios · {n} series» justo debajo, con la selección apenas marcada por el borde (`:105`). «Empezar esta sesión» queda al final de un documento de ~2.200 px CSS. Visible en 04 y 25.
- **La fila de chips extendidos no cabe y se corta.** Seis chips en 390 px con `overflow-x-auto` y sin indicador de scroll: en las capturas 13/15/16/17 la fila aparece desplazada y el chip de la izquierda o el de la derecha queda cortado por la mitad.
- **Más cromo cuanto menos datos.** Tendencias con datos casi vacíos (13) y Rendimiento a cero (15) son las páginas más largas (2.600 y 1.800 px CSS) y con más tarjetas, precisamente cuando no hay nada que contar.

---

## 7. Para el revisor externo

1. **Portada.** ¿Se sostiene una portada de «recuperación» como pantalla principal de una app cuyo trabajo es entrenar? ¿La tarjeta «Hoy toca» que propongo en §6.1 basta, o la portada debería ser directamente el entreno de hoy y bajar la recuperación a un segundo plano? ¿Qué debería ver el atleta en los primeros 5 segundos entre serie y serie?
2. **Modo foco y seguridad.** ¿Es aceptable que una pantalla de ejecución en curso conserve la barra de navegación global y una acción destructiva sin confirmación? ¿Debería «Terminar sesión» pedir confirmación siempre, o solo si faltan series? ¿Cómo se sale de una sesión en curso sin castigar al que solo quiere mirar el reloj?
3. **Densidad de filtros y jerarquía de listas.** En Actividades, ¿es correcto esconder filtros tras un botón «Filtros (n)», o es mejor mantener los chips de deporte siempre a la vista y plegar solo las fechas? Con el listón «una mano, entre series», ¿qué densidad de controles es defendible antes del contenido?
4. **Estados y confianza.** ¿Qué debería contar la interfaz cuando el estado real no se puede saber con certeza (envío al reloj, sincronización, guardado automático de pesos)? ¿Es mejor un estado explícito y persistente («Enviado hoy a las 18:04») que un acuse efímero? Y los errores que hoy se pintan en verde (§6.4), ¿deberían ser un componente de error propio?
5. **Coherencia visual y de contenido.** Con una estética tan consistente (tokens, tipografía condensada, oscuro), ¿los problemas de fondo son de sistema de diseño o de arquitectura de la información? En concreto: ¿qué cinco cambios de mayor impacto harías sobre estas capturas, sabiendo que varias no son del build actual (§5.3) y que faltan justo los estados de error y de carga?

---

*Fin del dossier. Todo lo afirmado procede de `frontend-nuevo/src/` (rutas y líneas citadas) o de una captura abierta y descrita en §5. Nada de lo escrito aquí se ha verificado ejecutando la app.*
