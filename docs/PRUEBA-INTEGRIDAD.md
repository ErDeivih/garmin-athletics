# Prueba de integridad de pesos: plan → reloj → guardado (GA-F1)

Criterio: una sesión con **tres pesos distintos** (50 / 52,5 / 55 kg) y comparación
**etapa por etapa**. Los tres pesos deben registrarse en las tres etapas y cualquier
diferencia tiene que quedar localizada (serie y etapa).

## Cómo se ejecuta

```powershell
.\venv\Scripts\python.exe tests\test_integridad_pesos.py
```

Es un test de backend con BD SQLite efímera y `TestClient` (no toca la base real ni
Garmin). Crea el ejercicio del catálogo, una plantilla con tres objetivos, lee lo que
vería el reloj (`GET /watch/today`), simula el envío de las tres series desde el reloj
(`POST /watch/sets`) y compara con la sesión guardada (`GET /strength/sessions/{id}`).

## Resultado (2026-11-11)

| Serie | Plan | Reloj | Guardado | Estado | Etapa |
|---|---|---|---|---|---|
| 1 | 50.0 | 50.0 | 50.0 | coincide | — |
| 2 | 52.5 | 52.5 | 52.5 | coincide | — |
| 3 | 55.0 | 55.0 | 55.0 | coincide | — |

Las tres etapas devuelven `[50.0, 52.5, 55.0]` y la comprobación serie a serie da
`coincide` en todas.

## Localización de una diferencia (prueba inyectada)

El test inyecta a propósito un peso distinto en la etapa del reloj (serie 3 → 56 kg) y
comprueba que el informe lo localiza:

| Serie | Plan | Reloj | Guardado | Estado | Etapa |
|---|---|---|---|---|---|
| 1 | 50.0 | 50.0 | 50.0 | coincide | — |
| 2 | 52.5 | 52.5 | 52.5 | coincide | — |
| 3 | 55.0 | **56.0** | 55.0 | **diferencia** | **reloj** |

Así, si en el futuro el plan, el payload del reloj o el guardado divergen, la tabla dice
en qué serie y en qué etapa está el problema.
