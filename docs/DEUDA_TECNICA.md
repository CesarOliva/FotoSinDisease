# Deuda técnica y pendientes — FotoSinDisease / FloraSense

Registro vivo de problemas detectados y trabajo pendiente. Marcar cada casilla al corregir y anotar la fecha/PR.

- **Última revisión:** 2026-11-07
- **Rama revisada:** `Frontend` (`7f67516`), con 4 archivos modificados sin commit.
- **Referencia de alcance:** `docs/FloraSense_Plan_Implementacion_8_Dias.md`

## Estado general

| Área | Estado | Evidencia |
|---|---|---|
| UI/UX (4 herramientas, responsive, estados) | Avanzado | `frontend/src/app/`, `frontend/src/components/` |
| Identificación con Pl@ntNet | Hecho | `backend/api/identify.py` |
| Ficha de cuidados con Ollama | Hecho, pero sin catálogo | `backend/api/profiles.py` |
| Análisis de salud + recomendaciones (P0) | **No implementado en backend** | solo mock en `frontend/src/lib/mocks.ts` |
| Catálogo botánico 15–20 especies (P0) | **No implementado** | no existe `backend/data/plants.json` |
| Segmentación DINO/SAM (P1) | Existe en otra rama, sin integrar | `origin/Experiments` |
| Tests / CI / deploy | **No implementado** | sin `backend/tests`, sin CI, sin Docker |

---

## P0 — Falta implementar (bloquea el MVP)

- [ ] **P0-01 · `POST /api/analyze` no existe.** El frontend lo llama en Diagnosticar (`frontend/src/lib/api.ts:124`) y falla con `USE_MOCKS=false`.
  - Criterio: recibe imágenes + `species` + `context`, devuelve `AnalysisResult` validado con Pydantic.
- [ ] **P0-02 · Catálogo botánico de 15–20 especies.** Crear `backend/data/plants.json` con `id`, nombres, familia, luz, riego, temperatura, humedad, sustrato, drenaje, tamaño, advertencias, fuentes y alias/sinónimos.
  - Criterio: resolución por nombre científico normalizado y respuesta limitada si la especie no existe.
- [ ] **P0-03 · `GET /api/plants/{id}`.** El contrato y el README lo piden; hoy solo hay `/api/plants/profile?scientificName=`.
  - Criterio: devuelve ficha del catálogo o 404; el frontend deja de depender de IA para fichas existentes.
- [ ] **P0-04 · Integración VLM real.** `VLM_API_KEY` y `VLM_MODEL` están definidos en `backend/.env.example` pero no se usan.
  - Criterio: observaciones de entorno/síntomas con incertidumbre y JSON validado; timeout y errores controlados.
- [ ] **P0-05 · Motor de recomendaciones en backend.** Hoy las reglas solo existen en `mockAnalyze` (`frontend/src/lib/mocks.ts`).
  - Criterio: recomendaciones basadas en ficha + contexto + síntomas, con `action` y `rationale`.
- [ ] **P0-06 · No inventar fichas para especies fuera del catálogo.** `profiles.py` genera una ficha para cualquier nombre.
  - Criterio: si no está en catálogo, respuesta limitada y sin parámetros inventados.
- [ ] **P0-07 · Tests P0 y fixtures.** No hay `backend/tests/`, pytest no está instalado, no hay tests de frontend ni E2E.
  - Criterio: checklist P0 del plan cubierto (1–3 fotos, 4 rechazada, formatos, tamaños, errores 429/502/504, sin API keys en frontend).
- [ ] **P0-08 · Entrega reproducible.** Sin deploy, colección de API, demo ni checklist QA ejecutada.
  - Criterio: README actualizado, `.env.example` completo, instrucciones de ejecución y demo de 3–5 min.

---

## Backend — Deuda técnica

- [ ] **BE-01 · Estructura incompleta.** Faltan `backend/schemas/`, `backend/services/`, `backend/data/` y `backend/tests/` respecto al plan.
- [ ] **BE-02 · Dependencias sin versión y faltantes.** `backend/requirements.txt` no fija versiones; faltan Pillow/OpenCV (y las de segmentación); usa `dotenv` en vez de `python-dotenv`.
- [ ] **BE-03 · Variables de entorno ignoradas.** `MAX_UPLOAD_SIZE_MB`, `MAX_IMAGES_PER_REQUEST`, `VLM_API_KEY`, `VLM_MODEL` no se leen; límites hardcodeados en `backend/api/identify.py:13,22,27`.
- [x] **BE-04 · Contrato de cantidad de fotos.** Backend acepta 1–5; plan y UI usan 1–3. Unificar en los dos lados.
  - Resuelto 2026-11-10: `identify.py` acepta 1–3 (`MAX_IMAGES = 3`) y `.env.example` usa `MAX_IMAGES_PER_REQUEST=3`. La variable sigue sin leerse (ver BE-03).
- [ ] **BE-05 · Formatos de imagen.** Plan exige WebP; backend y frontend solo aceptan JPG/PNG (`identify.py:19`, `validation.ts:1`).
- [ ] **BE-06 · Validación débil de archivos.** Se confía en `content_type`; no se validan magic bytes, dimensiones ni límite agregado del request; no se limpia EXIF.
- [ ] **BE-07 · Sin rate limiting, caché ni reintentos.** Ollama puede ocupar 180 s por petición; fichas se regeneran siempre.
- [ ] **BE-08 · Sin logs estructurados ni observabilidad.** No hay correlation ID, métricas ni logs sin datos sensibles.
- [ ] **BE-09 · `profiles.py` no valida la especie devuelta.** Fuerza `scientificName = name` (`profiles.py:173`); podría devolver datos de otra especie.
- [ ] **BE-10 · Falta `__init__.py` en `backend/api/`.** Funciona por namespace packages, pero conviene empaquetado explícito.
- [ ] **BE-11 · API sin versión ni OpenAPI exportado.** Sin `/api/v1`, sin contrato compartido ni ejemplos/fixtures.
- [ ] **BE-12 · CORS inconsistente.** `.env.example` apunta a IP LAN; en localhost el navegador queda bloqueado. Documentar y alinear.
- [ ] **BE-13 · `/health` mínimo.** No verifica dependencias (Pl@ntNet/Ollama) ni estado de configuración.

---

## Frontend — Deuda técnica

- [ ] **FE-01 · URL de API por defecto hardcodeada a IP de LAN.** `frontend/src/lib/api.ts:14` y `.env.example`; el README dice localhost. Usar localhost por defecto.
- [x] **FE-02 · `console.log` con respuestas de identificación.** `frontend/src/lib/api.ts:111,120`; eliminar para producción.
  - Resuelto 2026-11-10: eliminados.
- [x] **FE-03 · `MAX_IMAGES = 5` sin usar.** `frontend/src/lib/validation.ts:2`; no se valida cantidad de fotos.
  - Resuelto 2026-11-10: `MAX_IMAGES = 3` y `validateImageCount`. `imagesForm` (`api.ts`) bloquea envíos fuera de 1–3, también en modo mock. Las ranuras de Diagnosticar salen de `MAX_IMAGES`.
- [x] **FE-05 · `catalogId` nunca llega del backend real.** Solo funciona en modo mock; el badge "Ficha de cuidados" no aparecerá en producción.
  - Resuelto 2026-11-10 con la Fase 4 de `docs/improvements.md`: `/api/identify` añade `catalogId` cuando la especie está en `backend/data/plants.json`. Requiere generar el catálogo con `scripts/build_catalog.py`.
- [x] **FE-06 · Sin error boundaries ni páginas de estado.** Faltan `error.tsx`, `not-found.tsx`, `loading.tsx`.
  - Resuelto 2026-11-10: `app/error.tsx` (con `retry`, API de Next 16), `app/not-found.tsx`, `app/loading.tsx` y `app/global-error.tsx` para fallos del layout raíz.
- [x] **FE-07 · `AddPlantButton` sin manejo de errores.** `frontend/src/components/plants/add-plant-button.tsx:40-45` no captura fallos de `buildPlant`.
  - Resuelto 2026-11-10: `try/catch/finally`, mensaje de error y estado "Agregando…".
- [x] **FE-08 · `localStorage` silencia fallos de cuota.** `frontend/src/lib/plants-store.ts:39-43`; sin migración de esquema `v1`.
  - Resuelto 2026-11-10: formato versionado `{ version: 2, plants }` en `florasense:plants`. Los datos de `florasense:plants:v1` se migran y la clave antigua se borra solo si el nuevo guardado funciona. Cada planta se sanea al leerla. Los fallos de guardado se exponen con `usePlantsPersistFailed()`, y `StorageWarning` los avisa en recordatorios, detalle, calculadora y al agregar.
- [ ] **FE-09 · Sin script `typecheck` ni tests.** `package.json` solo tiene `lint`; agregar `typecheck`, Vitest/Playwright y E2E del flujo principal.
- [ ] **FE-10 · Accesibilidad mejorable.** `window.confirm` para borrar, transiciones de paso sin gestión de foco y sin `aria-live` en estados de carga.
- [ ] **FE-11 · Flags experimentales de Next sin verificación.** `cacheComponents` y `partialPrefetching` en `next.config.ts`; validar build de producción.
- [x] **FE-12 · Una sola foto en Identificar.** La herramienta usa 1 foto; el plan permite 1–3. Decidir si es intencional y documentarlo.
  - Resuelto 2026-11-10: decisión de máximo 3 fotos. La primera foto identifica al instante. Después se pueden añadir hasta 2 más (hoja, flor, fruto…), y cada cambio repite la identificación con todas. También se pueden quitar fotos (`components/identify/photo-strip.tsx`).

---

## Contratos, configuración y repositorio

- [ ] **CF-01 · Tipos duplicados a mano.** `frontend/src/lib/types.ts` vs Pydantic; generar desde OpenAPI o congelar contrato con fixtures.
- [ ] **CF-02 · `.env` desincronizados.**
  - `OLLAMA_MODEL`: resuelto, todo alineado a `llama3.2:1b`.
  - Tamaño máximo: frontend `.env.example` = 10 MB; backend = 5 MB.
- [ ] **CF-03 · `frontend/.env.local` con `USE_MOCKS=false`.** El entorno local depende de endpoints inexistentes; documentar modo de trabajo o dejar mocks por defecto.
- [ ] **CF-04 · Git sin integrar.** Rama `Frontend` con 4 archivos sin commit; `main` local 18 commits por delante de `origin/main`; `origin/Experiments` sin mergear.
- [ ] **CF-05 · Sin CI/CD ni Docker.** No hay pipeline de lint/tests/build ni despliegue reproducible.
- [ ] **CF-06 · Sin licencia, CONTRIBUTING ni plantilla de PR.** Definir antes de abrir el repo.
- [ ] **CF-07 · `experiments/requirements.txt` vacío** en `origin/Experiments`; documentar dependencias y entorno GPU.

---

## P1 — Investigación y segmentación

- [ ] **P1-01 · Mergear `origin/Experiments`.** Contiene DINOv2 + kNN (`construir_biblioteca.py`, `predecir_knn.py`, `dinov2/`), pero no está en `Frontend`/`main`.
- [ ] **P1-02 · Pipeline DINO → SAM 2 reproducible.** Verificar si existe la parte SAM; en los últimos commits se eliminó `sam2_demo/`.
- [ ] **P1-03 · `POST /api/segment`.** No implementado; el frontend ya muestra el estado "no disponible" correctamente.
- [ ] **P1-04 · Decisión go/no-go de segmentación web.** Documentar si se integra o queda como experimento.
- [ ] **P1-05 · Documentación del experimento.** README con versiones, GPU, dataset, comandos y resultados/limitaciones.

---

## Orden de corrección sugerido

- [ ] **Fase 0 — Desbloquear (½ día)**
  - Commitear cambios actuales.
  - Alinear `.env`/README y URL por defecto.
  - Quitar `console.log`.
  - Decidir `USE_MOCKS` por defecto.
- [ ] **Fase 1 — Núcleo P0 (2–3 días)**
  - `schemas.py`, `services/vision.py`, `services/recommendations.py`.
  - `data/plants.json` y `api/plants.py`.
  - `api/analyze.py`.
  - Decidir VLM: Ollama local o API externa.
- [ ] **Fase 2 — Contrato y calidad (1–2 días)**
  - Unificar 1–3 fotos y formatos.
  - Tests P0, fixtures, error boundaries, `typecheck` y CI.
- [ ] **Fase 3 — P1 (1–2 días)**
  - Mergear experimentos, documentar y decidir `/api/segment`.
- [ ] **Fase 4 — Entrega (1 día)**
  - Deploy, observabilidad, rate limiting, demo y checklist final.

---

## Notas

- Prioridad actual: **P0-01, P0-02, P0-03 y P0-05** desbloquean el flujo Diagnosticar de extremo a extremo.
- Mantener este archivo actualizado: marcar casillas y enlazar PRs cuando existan.
