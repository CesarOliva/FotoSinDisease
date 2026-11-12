
from pathlib import Path
from collections import defaultdict
import hashlib

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset" / "archive"

SPLITS = {
    "Train": DATASET_DIR / "Train" / "Train",
    "Validation": DATASET_DIR / "Validation" / "Validation",
    "Test": DATASET_DIR / "Test" / "Test"
}

EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

hashes = defaultdict(list)

for split, folder in SPLITS.items():
    for image in folder.rglob("*"):
        if image.is_file() and image.suffix.lower() in EXTENSIONS:
            digest = hashlib.sha256(image.read_bytes()).hexdigest()
            hashes[digest].append((split, image))

duplicates = {
    digest: files
    for digest, files in hashes.items()
    if len({split for split, _ in files}) > 1
}

print(f"Imágenes revisadas: {sum(map(len, hashes.values()))}")
print(f"Archivos duplicados entre conjuntos: {len(duplicates)}")

for files in duplicates.values():
    print("\nDuplicado encontrado:")
    for split, path in files:
        print(f"  {split}: {path}")
