import logging
from typing import Literal, TypeVar

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, ValidationError
from starlette.concurrency import run_in_threadpool

from services.plant_health import (
    InvalidImageError,
    ModelPrediction,
    ModelUnavailableError,
    predict_health,
)

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_IMAGES = 3
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ModelT = TypeVar("ModelT", bound=BaseModel)


class SelectedSpecies(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scientificName: str
    commonName: str | None = None
    confirmed: bool
    catalogId: str | None = None


class EnvironmentContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    locationType: Literal["indoor", "outdoor", "unknown"]
    light: Literal["direct", "indirect", "low", "unknown"]
    lastWatered: Literal[
        "today_yesterday",
        "2_4_days",
        "5_7_days",
        "over_7_days",
        "unknown",
    ]
    hasDrainage: Literal["yes", "no", "unknown"]
    city: str | None = None


def _parse_form_json(value: str, model: type[ModelT], field: str) -> ModelT:
    try:
        return model.model_validate_json(value)
    except ValidationError:
        raise HTTPException(422, f"El campo {field} no es válido") from None


def _recommendation(prediction: ModelPrediction) -> list[dict[str, str]]:
    if prediction["condition"] == "deteriorated":
        return [
            {
                "category": "monitoring",
                "priority": "medium",
                "action": "Revisa las hojas y compara otra foto en unos días.",
                "rationale": (
                    "El clasificador estima posible deterioro, pero no identifica "
                    "síntomas concretos ni su causa."
                ),
                "source": "visual_observation",
            }
        ]
    return [
        {
            "category": "monitoring",
            "priority": "low",
            "action": "Continúa observando la planta y toma otra foto si notas cambios.",
            "rationale": (
                "El clasificador estima un estado sano; la puntuación no garantiza "
                "que la planta esté libre de problemas."
            ),
            "source": "visual_observation",
        }
    ]


@router.post("/api/analyze")
async def analyze(
    images: list[UploadFile] = File(...),
    species: str = Form(...),
    context: str = Form(...),
):
    if not 1 <= len(images) <= MAX_IMAGES:
        raise HTTPException(422, f"Envía entre 1 y {MAX_IMAGES} imágenes")

    selected_species = _parse_form_json(species, SelectedSpecies, "species")
    environment_context = _parse_form_json(
        context,
        EnvironmentContext,
        "context",
    )

    image_contents = []
    for image in images:
        if image.content_type not in {"image/jpeg", "image/png"}:
            raise HTTPException(415, "Usa imágenes JPG o PNG")

        content = await image.read(MAX_IMAGE_BYTES + 1)
        if not content:
            raise HTTPException(422, "La imagen está vacía")
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Cada imagen debe pesar como máximo 5 MB")
        image_contents.append(content)

    try:
        prediction = await run_in_threadpool(predict_health, image_contents)
    except InvalidImageError as exc:
        raise HTTPException(422, str(exc)) from exc
    except ModelUnavailableError as exc:
        logger.exception("El modelo de salud no está disponible")
        raise HTTPException(503, str(exc)) from exc

    status = (
        "review_needed"
        if prediction["condition"] == "deteriorated"
        else "no_obvious_issues"
    )
    return {
        "species": selected_species.model_dump(),
        "environment": {
            "suggestedLocationType": environment_context.locationType,
            "observations": [],
        },
        "plantProfile": None,
        "health": {
            "status": status,
            "symptoms": [],
            "possibleCauses": [],
            "disclaimer": (
                "El estado y las puntuaciones son estimaciones de un clasificador "
                "visual, no probabilidades clínicas ni un diagnóstico. El modelo "
                "no identifica síntomas concretos ni sus causas."
            ),
            "modelPrediction": prediction,
        },
        "recommendations": _recommendation(prediction),
    }
