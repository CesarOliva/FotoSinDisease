import os
from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import Any, Literal, NamedTuple, TypedDict


class ModelUnavailableError(RuntimeError):
    pass


class InvalidImageError(ValueError):
    pass


class ModelPrediction(TypedDict):
    condition: Literal["healthy", "deteriorated"]
    confidence: float
    scores: dict[Literal["healthy", "deteriorated"], float]


class _Runtime(NamedTuple):
    torch: Any
    image: Any
    model: Any
    classifier: Any
    transform: Any
    device: Any


_runtime: _Runtime | None = None
_runtime_lock = Lock()
_CLASS_LABELS = {0: "healthy", 1: "deteriorated"}
_DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "experiments"
    / "dinov2"
    / "results"
    / "flora_classifier.joblib"
)


def _load_runtime() -> _Runtime:
    global _runtime

    if _runtime is None:
        with _runtime_lock:
            if _runtime is None:
                configured_path = os.getenv("FLORA_CLASSIFIER_PATH")
                model_path = (
                    Path(configured_path).expanduser()
                    if configured_path
                    else _DEFAULT_MODEL_PATH
                )
                if not model_path.is_absolute():
                    model_path = Path(__file__).resolve().parents[2] / model_path
                if not model_path.is_file():
                    raise ModelUnavailableError(
                        "No se encontró el clasificador de salud de plantas"
                    )

                try:
                    import joblib
                    import torch
                    from PIL import Image
                    from torchvision import transforms
                except (ImportError, OSError) as exc:
                    raise ModelUnavailableError(
                        "Faltan dependencias para ejecutar el modelo de salud"
                    ) from exc

                try:
                    model = torch.hub.load(
                        "facebookresearch/dinov2",
                        "dinov2_vits14",
                    )
                    model.eval()
                    device = torch.device(
                        "cuda" if torch.cuda.is_available() else "cpu"
                    )
                    model.to(device)
                    classifier = joblib.load(model_path)
                except (ImportError, OSError, RuntimeError, ValueError) as exc:
                    raise ModelUnavailableError(
                        "No se pudo cargar el modelo de salud de plantas"
                    ) from exc

                if set(int(class_id) for class_id in classifier.classes_) != {0, 1}:
                    raise ModelUnavailableError(
                        "El clasificador no contiene las clases de salud esperadas"
                    )

                transform = transforms.Compose(
                    [
                        transforms.Resize(256),
                        transforms.CenterCrop(224),
                        transforms.ToTensor(),
                        transforms.Normalize(
                            mean=(0.485, 0.456, 0.406),
                            std=(0.229, 0.224, 0.225),
                        ),
                    ]
                )
                _runtime = _Runtime(
                    torch,
                    Image,
                    model,
                    classifier,
                    transform,
                    device,
                )

    return _runtime


def predict_health(images: list[bytes]) -> ModelPrediction:
    runtime = _load_runtime()

    tensors = []
    for content in images:
        try:
            with runtime.image.open(BytesIO(content)) as image:
                tensors.append(runtime.transform(image.convert("RGB")))
        except (
            OSError,
            ValueError,
            runtime.image.DecompressionBombError,
        ) as exc:
            raise InvalidImageError("No se pudo leer una de las imágenes") from exc

    batch = runtime.torch.stack(tensors).to(runtime.device)
    with runtime.torch.inference_mode():
        embeddings = runtime.model(batch)

    probabilities = runtime.classifier.predict_proba(
        embeddings.cpu().numpy()
    ).mean(axis=0)
    scores: dict[Literal["healthy", "deteriorated"], float] = {
        "healthy": 0.0,
        "deteriorated": 0.0,
    }
    for class_id, probability in zip(
        runtime.classifier.classes_,
        probabilities,
    ):
        scores[_CLASS_LABELS[int(class_id)]] = float(probability)

    condition = max(scores, key=scores.__getitem__)
    return {
        "condition": condition,
        "confidence": scores[condition],
        "scores": scores,
    }
