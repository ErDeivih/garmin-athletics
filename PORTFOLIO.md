# Lyfta — app móvil para entrenar fuerza con tu reloj Garmin

**Portfolio de candidatura.** Producto real, en uso, con una sola usuaria diana (el
autor) y un recorrido completo: planificar un entrenamiento de fuerza con pesos por
serie, enviarlo al reloj Garmin desde la propia app, ejecutarlo sin teclear nada en la
muñeca, corregir los pesos reales al terminar y verlo en el historial.

- **Repositorio:** <https://github.com/ErDeivih/garmin-athletics>
- **Demo:** **<https://servidor.tail4263a0.ts.net>** — PWA servida por HTTPS con
  certificado del tailnet (WireGuard), instalable en el móvil y con arranque sin
  cobertura. Es una red privada: el enlace solo responde desde un dispositivo del tailnet
  de invitado, así que la demo se enseña en directo o por pantalla compartida.
- **Estado:** en uso desde el 2026-11-09, con PWA instalable y offline desde el
  2026-11-10. Pendiente solo la prueba física con el reloj (ver «Estado»).

---

## 1. El problema

Garmin Connect está pensado para correr y para el entreno de fuerza general; para
**progresar por series** (aproximación a 60 kg, trabajo a 65, tope a 70) obliga a crear el
entrenamiento en el móvil, esperar a que sincronice, y en el reloj acabas tecleando el
peso de cada serie o trabajando a ciegas. Al terminar, las series se pierden en un
registro genérico y no hay forma cómoda de corregir el peso real.

Lo que faltaba, en una frase: **un plan con pesos por serie que viaje al reloj y vuelva
como historial fiable**.

## 2. Qué demuestra

| Competencia | Cómo se ve en el proyecto |
|---|---|
| **Producto móvil de punta a punta** | 21 pantallas (React 19 + Vite + TypeScript), flujo planificar → enviar → entrenar → corregir → historial, con estados de carga, vacío y error en cada pantalla |
| **Integración con hardware real** | API de Garmin Connect y watch-app propia en Connect IQ (Monkey C) para el Forerunner 255: mapeo de ejercicios y enums, envío del workout con objetivos por serie, series idempotentes desde el reloj, `dry_run` para validar sin tocar la cuenta |
| **Offline y PWA** | HTTPS con certificado del tailnet; la app se instala (ventana en `display-mode: standalone`, sin barra del navegador) y **arranca sin cobertura**: recarga servida por el service worker con `onLine: false`, `transferSize: 0` y `workerStart > 0`. El borrador de la sesión se guarda en el móvil |
| **Backend de datos** | FastAPI + SQLAlchemy async + SQLite, migraciones idempotentes, 21 guiones de contrato sobre una base efímera |
| **Diseño y sistema de diseño** | Tokens de color/tipografía, contraste AA comprobado, escala de espaciado, regresión visual con `pixelmatch` (4 pantallas, 0 píxeles) |
| **Despliegue y operación** | Imagen Docker de dos etapas, servidor doméstico, acceso privado por Tailscale, verificación automática del despliegue (`verify-server.sh`), sin abrir puertos en el router |
| **Método de trabajo** | Rojo → verde en cada arreglo, sin dependencia de CI externa, evidencia en capturas e informes JSON versionados |

## 3. El flujo, en capturas

Todas están tomadas a 390 × 844 (viewport real de móvil) contra la app desplegada.

![Plan con pesos por serie 60/65/70](docs/capturas-movil/03-plan-pesos.png)
![Sesión guardada: 60/65/70 y 1420 kg](docs/capturas-movil/07-sesion-terminada.png)
![La app abierta con la red apagada](docs/capturas-movil/https-arranque-sin-cobertura.png)

| | |
|---|---|
| **Plan con pesos por serie** — 60 / 65 / 70 kg, botones − / + y guardado automático. [03-plan-pesos.png](docs/capturas-movil/03-plan-pesos.png) | **Edición de una serie** — 65 → 67,5 kg, «Guardado a las …». [03b-edicion-serie.png](docs/capturas-movil/03b-edicion-serie.png) |
| **Envío al reloj** — un botón, estado Pendiente/Enviado/Error y guía de sincronización. [04b-envio-enviado.png](docs/capturas-movil/04b-envio-enviado.png) | **Entrenar** — las tres series con su peso y reps ya puestos. [06-entrenar.png](docs/capturas-movil/06-entrenar.png) |
| **Sesión guardada** — 60/65/70, 1420 kg, reparto muscular. [07-sesion-terminada.png](docs/capturas-movil/07-sesion-terminada.png) | **Corregir después de entrenar** — 60 → 62,5 kg persistido. [09-editar-tras-entrenar.png](docs/capturas-movil/09-editar-tras-entrenar.png) |
| **Historial** — la sesión aparece en «Últimas sesiones». [10-historial-sesion.png](docs/capturas-movil/10-historial-sesion.png) | **Sin cobertura** — la app abierta con la red apagada. [https-arranque-sin-cobertura.png](docs/capturas-movil/https-arranque-sin-cobertura.png) |
| **PWA instalada** — ventana en modo app, sin barra del navegador. [pwa-instalada-ventana.png](docs/capturas-movil/pwa-instalada-ventana.png) | **Instalada y sin cobertura** — recargada con la red apagada. [pwa-instalada-sin-cobertura.png](docs/capturas-movil/pwa-instalada-sin-cobertura.png) |

Los datos de las capturas son de una ejecución real contra el despliegue (copia
desechable de la base, sin tocar la cuenta de Garmin). Informe:
`docs/capturas-movil/informe-flujo.json`.

## 4. Evidencia de calidad

| Suite | Resultado |
|---|---|
| Frontend (Vitest + Testing Library) | **51/51 pruebas en 21 ficheros** |
| Backend (guiones de contrato con TestClient) | **21/21**, base SQLite efímera |
| Regresión visual (Playwright + pixelmatch) | **4/4 pantallas, 0 píxeles** distintos |
| PWA instalada (Chrome, ventana `--app`) | `display-mode: standalone`, service worker controlando, **arranque sin cobertura** (`onLine: false`, `transferSize: 0`, `workerStart > 0`) |
| Contraste y escala tipográfica | 52 pares AA, espaciado dentro de la escala |
| Despliegue | `verify-server.sh`: salud, rutas profundas, cabeceras y datos OK |

Método: cada arreglo empieza por una prueba que falla. Ejemplo reciente: la sesión
guardaba 60/60/60 en vez de 60/65/70 porque el borrador ignoraba `set_targets`; la prueba
`session-pesos.test.tsx` falla antes del arreglo (esperaba 60 y recibía 82,5) y pasa
después, y la corrección posterior a entrenar tiene su propio guion de contrato
(`tests/test_session_weight_correction.py`).

## 5. Decisiones de producto (lo que aporta la mirada de analista)

- **Una sola URL y un solo origen** sirven la app y la API: el móvil no tiene que saber
  dónde está el backend, y el service worker cachea un único origen.
- **Un backend por cuenta de Garmin**, porque los tokens se renuevan al usarlos; se
  documenta como regla para no invalidar la sesión.
- **El plan manda sobre la última marca**: si el plan dice 60/65/70, la sesión arranca
  con 60/65/70; la última marca solo actúa de respaldo cuando no hay objetivos.
- **Los avisos son tarjetas visibles, no mensajes escondidos**: la app muestra
  «Reloj real · pendiente» con los pasos que faltan, en vez de ocultar el estado real.
- **Privacidad del dato primero**: la app vive en la red privada, no se publica en
  Internet y no se abre ningún puerto en el router.
- **La evidencia se versiona**: capturas numeradas e informes JSON de cada pasada, para
  que cualquiera pueda comprobar lo que se afirma.

## 6. Estado

**Funcionando hoy:** crear el plan con pesos por serie, editarlo, enviarlo a Garmin,
entrenar, guardar la sesión con los pesos correctos, corregirla después, historial,
actividades y análisis del reloj, calendario semanal, rutas, y uso desde el móvil **dentro
y fuera de casa**, con la PWA instalable por HTTPS y arranque sin cobertura.

**Pendiente:**
- **Prueba física del Forerunner 255** (reloj cargado, 2FA delante, comprobar el peso en
  el reloj y contar las repeticiones reales del detector). Es lo único que no puede hacer
  un agente; los pasos están en `PENDIENTE-PRUEBA-RELOJ.md`.
- Medición del detector de repeticiones con series reales y ajuste del algoritmo.

## 7. Tecnologías

**Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS v4 con
tokens de diseño propios, Lucide, Vitest + Testing Library, Playwright + pixelmatch.
**Backend:** Python 3.12, FastAPI, SQLAlchemy 2 async, SQLite, Pydantic v2, APScheduler,
`garminconnect`, Uvicorn.
**Reloj:** Connect IQ (Monkey C), Forerunner 255, sensores y cierre automático de serie.
**Infraestructura:** Docker multi-etapa, Debian 12, Tailscale (acceso privado), Nginx no
necesario (FastAPI sirve el build), scripts de verificación propios.
**Método:** tests en local, sin GitHub Actions; capturas y informes como evidencia.

## 8. Documentación del proyecto

- `DESPLIEGUE.md` — cómo está desplegado, cómo se actualiza y cómo se comprueba.
- `docs/USO-MOVIL.md` — bloque único con los 3 pasos de instalación y lo que falta para el reloj.
- `docs/revision-interfaz-movil.md` — dossier de interfaz: 17 capturas y 10 problemas con su arreglo.
- `PENDIENTE-PRUEBA-RELOJ.md` — la única parte que depende del reloj físico.
- `WALL.md` y `ESTADO-AGENTE.md` — estado y evidencias del proyecto.
