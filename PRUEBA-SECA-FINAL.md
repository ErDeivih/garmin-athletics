# Prueba final en seco del flujo móvil — 2026-11-08

Sin Garmin real: el envío se valida con `dry_run` y la watch-app se simula con las
llamadas HTTP que haría. La base de datos es SQLite efímera.

## Flujo

1. Plan móvil con series **60 / 65 / 70 kg** y reps **8 / 8 / 6**.
2. Envío validado con `dry_run`; sin errores de mapeo.
3. El reloj recibe el entreno y los objetivos por serie.
4. El reloj devuelve las tres series.
5. La sesión queda guardada y se consulta con sus pesos y reps.

## Comando

```powershell
.\\venv\\Scripts\\python.exe tests\\test_dry_run_watch_flow.py
```

Salida:

```text
SUCCESS: plan móvil -> dry-run -> reloj -> 3 series -> sesión guardada con 60/65/70 kg.
```

## Capturas

- [Plan con pesos](frontend-nuevo/screenshots/27-flujo-seco-plan.png)
- [Enviado al reloj](frontend-nuevo/screenshots/28-flujo-seco-envio.png)
- [Sesión guardada](frontend-nuevo/screenshots/29-flujo-seco-sesion.png)

## Regresión visual

```powershell
cd frontend-nuevo
npm run visual
```

Resultado: **4/4 pantallas OK, 0 píxeles distintos, 0 fallos** contra
`frontend-nuevo/screenshots/visual-baseline/`.

## Pendiente real

- Enviar de verdad al fr255 desde la app y comprobar el objetivo en el reloj.
- Importar las series reales y cerrar la sesión.
- Medir el detector de repeticiones con series reales.
- Capturar la watch-app si el simulador entrega un frame válido.
