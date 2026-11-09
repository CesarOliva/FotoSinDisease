
from pathlib import Path
import sys

import torch
import joblib

from PIL import Image
from torchvision import transforms


# =====================================
# CONFIGURACIÓN
# =====================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "results" / "flora_classifier.joblib"

CLASSES = {
    0: "Sana",
    1: "Deteriorada"
}


# =====================================
# VALIDAR ARGUMENTO
# =====================================

if len(sys.argv) < 2:
    print("Uso: python predict_image.py <ruta_imagen>")
    sys.exit(1)

IMAGE_PATH = Path(sys.argv[1])

if not IMAGE_PATH.is_file():
    print(f"No se encontró la imagen: {IMAGE_PATH}")
    sys.exit(1)

if not MODEL_PATH.is_file():
    print(f"No se encontró el modelo: {MODEL_PATH}")
    sys.exit(1)


# =====================================
# DISPOSITIVO
# =====================================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print(f"Dispositivo: {device}")


# =====================================
# CARGAR DINOV2
# =====================================

print("\nCargando DINOv2...")

model = torch.hub.load(
    "facebookresearch/dinov2",
    "dinov2_vits14"
)

model.eval()
model.to(device)

print("DINOv2 cargado.")


# =====================================
# TRANSFORMACIONES
# =====================================

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=(0.485, 0.456, 0.406),
        std=(0.229, 0.224, 0.225)
    )
])


# =====================================
# PROCESAR IMAGEN
# =====================================

print("\nProcesando imagen...")

image = Image.open(IMAGE_PATH).convert("RGB")
tensor = transform(image).unsqueeze(0).to(device)

with torch.inference_mode():
    embedding = model(tensor)

embedding = embedding.cpu().numpy()


# =====================================
# CARGAR CLASIFICADOR
# =====================================

print("Cargando clasificador...")

classifier = joblib.load(MODEL_PATH)


# =====================================
# PREDICCIÓN
# =====================================

prediction = classifier.predict(embedding)[0]

probabilities = classifier.predict_proba(embedding)[0]

print("\n========== RESULTADO ==========")

print(f"Imagen: {IMAGE_PATH.name}")
print(f"Estado estimado: {CLASSES[int(prediction)]}")

print("\nPuntuaciones estimadas:")

for class_id, probability in zip(
    classifier.classes_,
    probabilities
):
    print(
        f"{CLASSES[int(class_id)]}: "
        f"{probability * 100:.2f}%"
    )

print("===============================")
print(
    "Nota: estas puntuaciones son estimaciones del modelo, "
    "no probabilidades clínicas ni garantías de diagnóstico."
)
