# Mejoras de rendimiento para `/api/plants/profile`

Notas para acelerar la generación de fichas con Ollama sin salir del entorno local.

- **Fecha:** 2026-11-07
- **Equipo:** Ryzen 7 5700U (8 núcleos / 16 hilos), 16 GB RAM, GPU integrada Radeon.
- **Ollama:** local en `http://localhost:11434`, sin GPU dedicada (`size_vram: 0`).
- **Modelo en uso:** `llama3.2:1b` (Q8_0, ~1.3 GB).
- **Restricciones del proyecto:** todo debe correr localmente; se puede cachear la respuesta de la IA; el catálogo solo se guardaría si su información proviene del modelo.

---

## 1. Medición actual

### Línea base real

Llamada a `GET /api/plants/profile?scientificName=Monstera deliciosa` con el modelo ya cargado:

| Métrica | Valor |
|---|---|
| Tiempo total observado | **107.1 s** |
| Modelo | `llama3.2:1b` Q8_0 |
| Ejecución | CPU (`size_vram: 0`) |
| Respuesta | Válida: 3 problemas comunes, 4 prevenciones |

Una repetición directa de la misma generación superó los 180 s, lo que confirma que el tiempo es variable y puede empeorar por contención de CPU o memoria.

### Benchmark corto del modelo

Petición mínima (`num_predict: 20`):

| Métrica | Valor |
|---|---|
| Carga del modelo | 2.7 s |
| Prompt de 31 tokens | 0.39 s (~79 tok/s) |
| Generación de 3 tokens | 0.198 s (~15 tok/s) |
| Total | 3.3 s |

### Tamaño real del prompt

Capturando el payload que construye `backend/api/profiles.py`:

| Parte | Caracteres | Tokens aprox. |
|---|---:|---:|
| Sistema (instrucciones + schema) | 5,381 | ~1,345 |
| Schema JSON repetido dentro del sistema | 3,915 | ~979 |
| Ejemplo de respuesta (`assistant`) | 2,071 | ~518 |
| Mensajes de usuario | 80 | ~20 |
| **Total del prompt** | **7,532** | **~1,883** |

Además, `num_predict` está en **2048**, por lo que el modelo puede generar una respuesta muy larga.

### Dónde se va el tiempo (estimación)

Con las tasas medidas:

- **Prefill** de ~1,883 tokens a ~79 tok/s: **~24 s**.
- **Generación** de ~600–1,000 tokens a ~15 tok/s: **~40–66 s**.
- Carga del modelo y overhead: **~3–10 s**.

Conclusión: no hay un único culpable. Tanto el prompt como la longitud de salida pesan, y la falta de caché hace que se repita todo en cada consulta.

### Factor adicional observado

Ahora mismo Ollama tiene cargados **dos modelos a la vez**:

- `llama3.2:1b` (~1.5 GB en RAM).
- `llama3.1:8b` (~5.6 GB en RAM).

En un equipo de 16 GB, mantener ambos cargados aumenta la presión de memoria y puede provocar más lentitud o swap.

---

## 2. Ideas ordenadas por impacto

| # | Mejora | Impacto esperado | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1 | Caché persistente en backend | Consultas repetidas: de ~107 s a <100 ms | Bajo | Cachear una ficha incorrecta |
| 2 | Deduplicar generaciones en vuelo | Varias peticiones simultáneas → una sola generación | Bajo | Bajo |
| 3 | Quitar el schema duplicado del prompt | ~13 s menos por generación | Muy bajo | Bajo si `format` sigue activo |
| 4 | Acortar instrucciones y ejemplo | ~6–10 s menos | Bajo | Puede bajar calidad/estilo |
| 5 | Reducir salida (`num_predict`, menos problemas) | ~25–35 s menos | Bajo/Medio | Menos detalle |
| 6 | Mantener solo el modelo 1B cargado y `keep_alive` | Menos presión de RAM; evita arranques en frío | Muy bajo | Bajo |
| 7 | Caché en frontend + prefetch de candidatos | Ficha lista al elegir especie | Bajo | Generaciones en segundo plano compiten por CPU |
| 8 | Catálogo generado por el modelo y revisado | Especies del catálogo: instantáneas | Medio | Requiere revisión humana |
| 9 | Streaming o 202 + polling | Mejora la espera percibida | Medio | Más complejidad de UI/backend |
| 10 | Cuantización Q4_K_M del 1B | Posible mejora leve en CPU | Bajo | Menor calidad; hay que medir |

No se contemplan APIs en la nube, modelos 8B ni catálogos escritos a mano: el objetivo es aprender con modelos locales y mantener la info generada por el modelo.

---

## 3. Plan recomendado

### Fase 0 — Medir y ordenar el entorno (30 min) ✅

- [x] Descargar el modelo 8B para liberar RAM: `ollama stop llama3.1:8b`.
- [x] Configurar Ollama para mantener solo un modelo cargado:
  - `OLLAMA_MAX_LOADED_MODELS=1`
  - `OLLAMA_KEEP_ALIVE=30m`
  - `OLLAMA_NUM_PARALLEL=1`
- [x] Añadir logs de las métricas que ya devuelve Ollama:
  - `load_duration`
  - `prompt_eval_count` y `prompt_eval_duration`
  - `eval_count` y `eval_duration`
  - `total_duration`
- [x] Medir 3 especies distintas y guardar los resultados en una tabla.

Estas métricas permiten comprobar si cada cambio realmente mejora algo.

**Resultados de la medición (Fase 0)** — `llama3.2:1b`, CPU, un solo modelo cargado:

| Especie | Total Ollama | Carga | Prompt eval | Generación | Tiempo cliente |
|---|---:|---:|---:|---:|---:|
| Monstera deliciosa | 123.33 s | 4.34 s | 1,099 tok / 20.98 s (52.4 tok/s) | 814 tok / 97.96 s (8.3 tok/s) | 125.3 s |
| Lavandula angustifolia | 73.08 s | 0.02 s | 1,101 tok / 0.58 s (1,898 tok/s) | 622 tok / 72.46 s (8.6 tok/s) | 74.7 s |
| Ficus lyrata | 72.73 s | 0.02 s | 1,097 tok / 0.46 s (2,364 tok/s) | 632 tok / 72.22 s (8.8 tok/s) | 74.3 s |

La segunda y tercera especie se benefician de tener el modelo ya cargado y del prefijo de prompt cacheado (sistema + ejemplo); la primera incluye la carga del modelo. La generación ronda los 8–9 tok/s, así que la longitud de salida sigue siendo el mayor coste.

### Fase 1 — Recortar el prompt (1–2 h) ✅ (sin ejemplo compacto)

En `backend/api/profiles.py`:

- [x] **Quitar el schema del texto del sistema.** Ya se envía en `format`, así que repetirlo en el prompt solo gasta prefill.
  - Eliminar: `"... Esquema: " + json.dumps(schema, ensure_ascii=False)`.
  - Ahorro: ~3,915 caracteres (~979 tokens) por petición.
  - Nota: el código actual ya no incluía el schema en el mensaje de sistema; solo se envía en `format`. No hubo ahorro adicional por este punto.
- [x] **Acortar las instrucciones** a lo esencial: español, especie exacta, incertidumbre, `sources: []`, problemas específicos y no repetidos, campos concisos.
- [ ] **Sustituir el ejemplo largo por uno compacto** o eliminarlo y comprobar la calidad. El ejemplo actual son ~2,071 caracteres (~518 tokens). **Pendiente por decisión explícita.**
- [x] **Bajar `num_predict`** de 2048 a ~900–1100.
- [x] **Bajar `num_ctx`** a 2048 o 3072 si el prompt recortado cabe.
- [x] **Pedir como máximo 3 problemas comunes** en la primera generación, en vez de hasta 5.
- [x] Comparar calidad antes/después con las mismas 3 especies.

**Resultados (Fase 1, mismas 3 especies):**

| Especie | Total Fase 0 | Total Fase 1 | Prompt eval (frío) | Generación | Cliente Fase 1 |
|---|---:|---:|---:|---:|---:|
| Monstera deliciosa | 123.33 s | 90.88 s | 1,015 tok / 16.74 s | 641 tok / 74.03 s | 92.7 s |
| Lavandula angustifolia | 73.08 s | 76.80 s | 1,017 tok / 0.52 s | 664 tok / 76.22 s | 78.3 s |
| Ficus lyrata | 72.73 s | 54.98 s | 1,013 tok / 0.40 s | 475 tok / 54.54 s | 56.6 s |
| **Media** | **89.71 s** | **74.22 s** | **~1,015 tok** | **~593 tok** | **75.9 s** |

- El prompt real bajó de ~1,099 a ~1,015 tokens (~8 %): el gran ahorro esperado no existía porque el schema no estaba duplicado.
- El prefill en frío bajó de 20.98 s a 16.74 s. La primera generación sigue en ~91 s (no en 45–60 s) porque el ejemplo largo (~518 tokens) se mantiene y la generación a ~8.7 tok/s domina el tiempo.
- La media total mejora ~17 %, pero Lavandula fue algo más lenta por generar más tokens.
- Calidad: Monstera mantiene 3 problemas correctos. Lavandula sigue con problemas poco específicos y ahora repite uno. Ficus devolvió un solo problema ("Pétalos amarillos", anatomía incorrecta), igual que en Fase 0. La debilidad viene del modelo 1B, no del recorte.

### Fase 2 — Caché persistente y deduplicación (2–4 h) ✅

#### 2.1 Caché

Opciones válidas:

- **Archivos JSON por especie** (simple y fácil de inspeccionar):
  `backend/data/cache/<modelo>/<nombre-normalizado>.json`
- **SQLite** (más robusto si hay muchas escrituras):
  `backend/data/profiles_cache.sqlite3`

Recomendación para este proyecto: empezar con **archivos JSON** y escritura atómica (`temp` + `replace`).

Estructura sugerida:

```json
{
  "scientificName": "Monstera deliciosa",
  "model": "llama3.2:1b",
  "promptVersion": "v3",
  "generatedAt": "2026-11-07T20:00:00Z",
  "reviewed": false,
  "profile": { "...": "PlantProfile validado" }
}
```

Reglas:

- [x] Clave = nombre científico normalizado + modelo + versión del prompt.
- [x] Si hay caché, devolverla sin llamar a Ollama.
- [x] Si no hay, generar, validar con Pydantic y guardar.
- [x] TTL configurable (por ejemplo 30 días) o invalidación por cambio de modelo/prompt.
- [x] Endpoint opcional `?refresh=true` para regenerar manualmente.
- [x] No cachear respuestas inválidas.
- [x] Normalizar el nombre igual que ya se hace en `profiles.py` (sin acentos, minúsculas, guiones).

#### 2.2 Deduplicación

- [x] Mantener un `dict` de peticiones en vuelo: `nombre -> asyncio.Task/Future`.
- [x] Si llega una segunda petición para la misma especie mientras la primera genera, esperar la misma tarea.
- [x] Evita que dos componentes del frontend generen la misma ficha a la vez.

**Implementación:**

- `backend/services/profile_cache.py`: lectura/escritura de JSON, normalización, TTL, validación de modelo/versión y escritura atómica (`temp` + `os.replace`).
- `backend/api/profiles.py`: consulta de caché, deduplicación con `asyncio.Task` y parámetro `refresh`.
- Ruta: `backend/data/cache/<modelo>/<nombre-normalizado>.json`. El modelo se sanea para Windows (`llama3.2:1b` → `llama3.2-1b`).
- TTL: `PROFILE_CACHE_TTL_DAYS` (30 días por defecto). La versión del prompt es `v3`.
- La caché está excluida de git (`backend/data/cache/`).

**Resultados de la verificación:**

| Prueba | Resultado |
|---|---|
| Primera consulta (Monstera, sin caché) | ~79 s, genera y guarda |
| Consultas siguientes | ~10–20 ms en servidor; <200 ms de extremo a extremo |
| Persistencia tras reiniciar el backend | Hit correcto |
| Dos peticiones simultáneas sin caché | 75.67 s en total, **una sola** llamada a Ollama |
| `?refresh=true` | Ignora la caché, regenera (~74 s) y actualiza `generatedAt` |
| Nombre con distinto formato (`monstera deliciosa`) | Hit sobre la misma entrada |
| Ficha cacheada inválida | Se ignora y se regenera; nunca se devuelve |
| Respuesta inválida de Ollama (Aloe vera) | No se cachea |

Nota: el intento con Aloe vera agotó `num_predict=1000` y devolvió JSON truncado. No se cacheó. Conviene subir el límite o añadir un reintento si aparece en la demo.

Resultado esperado: **caché hit <100 ms**; primera generación igual que en Fase 1.

### Fase 3 — Caché en frontend y prefetch (2–3 h)

- [ ] Mover la caché de fichas fuera del estado del componente. Hoy `usePlantIdentification` guarda `profiles` en estado local, así que al cambiar de pantalla se pierde.
- [ ] Crear `frontend/src/lib/profile-cache.ts` con:
  - `Map` en memoria + `sessionStorage` o `localStorage`.
  - TTL y clave por nombre + modelo.
  - Deduplicación de promesas en vuelo.
- [ ] Al recibir candidatos de Pl@ntNet, prefetch de la **primera** especie en segundo plano.
  - No prefetch de las 3 a la vez en CPU: competirían con la petición principal.
- [ ] Mostrar un mensaje claro mientras se genera: "Generando ficha local, puede tardar ~1 minuto".

### Fase 4 — Catálogo generado por el modelo (medio día)

Si se decide guardar catálogo, hacerlo con información producida por el modelo y con trazabilidad:

- [ ] Crear `backend/scripts/build_catalog.py` con una lista de 15–20 especies.
- [ ] Para cada especie, llamar al mismo prompt, validar con `PlantProfile` y guardar en `backend/data/plants.json`.
- [ ] Añadir metadatos de procedencia:
  - modelo usado
  - fecha de generación
  - versión del prompt
  - `reviewed: false`
- [ ] Revisar manualmente las fichas y marcar `reviewed: true`.
- [ ] Servir primero el catálogo y usar el modelo solo para especies nuevas.
- [ ] Asignar `catalogId` en `/api/identify` cuando el nombre coincida con el catálogo.
- [ ] Documentar en la UI/README que la ficha fue generada por IA y no verificada por una fuente externa.

Ventaja: las especies del catálogo son instantáneas y se reduce el riesgo de respuestas distintas para la misma planta.

### Fase 5 — Opcional: mejorar la espera percibida

- [ ] `stream: true` en Ollama y SSE desde FastAPI para mostrar progreso.
- [ ] O un flujo 202 + job ID + polling.
- [ ] O simplemente un estado de carga más informativo con tiempo estimado.

No es prioritario si la caché y el recorte ya dejan la primera generación en ~1 minuto.

---

## 4. Cambios concretos sugeridos en `profiles.py`

Orden de menor a mayor esfuerzo:

1. Quitar `json.dumps(schema)` del mensaje de sistema.
2. Acortar `PROFILE_EXAMPLE` a un ejemplo mínimo.
3. Reducir `num_predict` a ~1000.
4. Pedir 3 problemas como máximo.
5. Añadir `keep_alive: "30m"` a la petición.
6. Añadir caché antes de llamar a Ollama.
7. Registrar métricas de Ollama.

Esquema de la caché en el endpoint:

```text
1. Normalizar scientificName.
2. Construir clave: nombre | modelo | promptVersion.
3. ¿Existe en caché y es válida? -> devolver.
4. ¿Hay una generación en vuelo para esa clave? -> esperarla.
5. Generar con Ollama.
6. Validar con PlantProfile.
7. Guardar en caché de forma atómica.
8. Devolver.
```

---

## 5. Configuración de Ollama recomendada

Variables de entorno (reiniciar Ollama después de cambiarlas):

```text
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_PARALLEL=1
```

Comandos útiles:

```powershell
ollama stop llama3.1:8b
ollama ps
ollama list
```

Notas:

- `OLLAMA_KEEP_ALIVE=30m` evita que el modelo se descargue entre pruebas.
- `OLLAMA_MAX_LOADED_MODELS=1` evita tener 1B y 8B en RAM a la vez.
- `OLLAMA_NUM_PARALLEL=1` evita que dos generaciones compitan por la CPU.
- En CPU, probar `num_thread` con 6, 8 y 12; quedarse con el mejor resultado medido.
- No se recomienda cambiar a 8B: el objetivo es usar modelos locales y el 8B es ~4–8 veces más lento en este equipo.

---

## 6. Criterios de aceptación

- [ ] Segunda consulta de la misma especie responde en **<200 ms**.
- [ ] Primera generación de una especie nueva baja de ~107 s a **<60 s**.
- [ ] Dos peticiones simultáneas de la misma especie generan **una sola** ficha.
- [ ] La caché sobrevive a reinicios del backend.
- [ ] Una ficha cacheada inválida no se devuelve.
- [ ] Solo hay un modelo cargado en Ollama durante las pruebas normales.
- [ ] Las métricas de Ollama quedan registradas para comparar versiones.
- [ ] La UI indica claramente cuándo está generando una ficha local.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cachear una ficha incorrecta | Revisión manual, campo `reviewed`, botón de regenerar |
| Quedarse con datos obsoletos | Clave con modelo + versión del prompt; TTL; `refresh=true` |
| Pérdida de calidad al recortar el prompt | Comparar 3 especies antes/después; mantener un ejemplo mínimo si hace falta |
| Dos peticiones compitiendo por CPU | Deduplicación en backend y frontend; `OLLAMA_NUM_PARALLEL=1` |
| Memoria insuficiente | Un solo modelo cargado; no usar 8B en este equipo |
| Crecimiento del caché | Poda por antigüedad o límite de entradas |
| El catálogo generado se presenta como verdad | Marcar `reviewed`, mostrar aviso y no inventar fuentes (`sources: []`) |

---

## 8. Prioridad inmediata

1. Liberar RAM y dejar solo `llama3.2:1b` cargado.
2. Quitar el schema duplicado del prompt y bajar `num_predict`.
3. Implementar caché persistente + deduplicación.
4. Medir de nuevo con 3 especies y registrar los números.
5. Recién después evaluar catálogo generado por el modelo y mejoras de UX.
