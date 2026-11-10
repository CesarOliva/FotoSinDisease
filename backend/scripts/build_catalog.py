"""Genera `backend/data/plants.json` con el modelo local (Ollama).

Uso (desde `backend/`, con Ollama en marcha):

    python scripts/build_catalog.py               # solo especies que faltan
    python scripts/build_catalog.py --only "Ficus lyrata"
    python scripts/build_catalog.py --force       # regenera las no revisadas

Reglas:
- Usa el mismo prompt y validación que `/api/plants/profile`.
- Guarda después de cada especie, así un corte no pierde lo ya generado.
- Nunca sobrescribe una entrada con `reviewed: true`.
- Cada entrada registra procedencia: modelo, fecha, versión del prompt.
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402
from fastapi import HTTPException  # noqa: E402

from api.profiles import _finalize_profile, _generate_profile_checked  # noqa: E402
from services.catalog import CATALOG_PATH, load_raw_entries, write_raw_entries  # noqa: E402
from services.profile_cache import PROMPT_VERSION, normalize_name  # noqa: E402

logger = logging.getLogger("build_catalog")

# 18 plantas de interior y aromáticas habituales. Editable: añade o quita nombres
# científicos aquí y vuelve a ejecutar el script.
CATALOG_SPECIES = [
    "Monstera deliciosa",
    "Epipremnum aureum",
    "Sansevieria trifasciata",
    "Spathiphyllum wallisii",
    "Chlorophytum comosum",
    "Zamioculcas zamiifolia",
    "Aloe vera",
    "Ficus lyrata",
    "Ficus elastica",
    "Dracaena trifasciata",
    "Calathea ornata",
    "Lavandula angustifolia",
    "Mentha spicata",
    "Ocimum basilicum",
    "Chamaedorea elegans",
    "Schefflera arboricola",
    "Philodendron hederaceum",
    "Crassula ovata",
]


def _entry_for(name: str, model: str, profile_dict: dict) -> dict:
    return {
        "catalogId": normalize_name(name),
        "scientificName": name,
        "reviewed": False,
        "provenance": {
            "generator": "ollama",
            "model": model,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "promptVersion": PROMPT_VERSION,
        },
        "profile": profile_dict,
    }


async def build(names: list[str], force: bool, model: str) -> int:
    entries = {entry["catalogId"]: entry for entry in load_raw_entries(CATALOG_PATH)}
    failures: list[str] = []

    for name in names:
        catalog_id = normalize_name(name)
        existing = entries.get(catalog_id)

        if existing and existing.get("reviewed") is True:
            logger.info("Omitida (revisada, no se sobrescribe): %s", name)
            continue
        if existing and not force:
            logger.info("Omitida (ya existe; usa --force para regenerar): %s", name)
            continue

        logger.info("Generando %s con %s…", name, model)
        try:
            profile = _finalize_profile(await _generate_profile_checked(name, model), name)
        except HTTPException as exc:
            logger.error("Fallo al generar %s: %s", name, exc.detail)
            failures.append(name)
            continue

        entries[catalog_id] = _entry_for(name, model, profile.model_dump(mode="json"))
        # Guardado incremental: si se interrumpe, se reanuda con la misma orden.
        write_raw_entries(list(entries.values()), CATALOG_PATH)
        logger.info("Guardada %s en %s", name, CATALOG_PATH)

    if failures:
        logger.error("Especies sin generar: %s", ", ".join(failures))
        return 1
    return 0


def main() -> int:
    load_dotenv(BACKEND_DIR / ".env")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="regenera entradas no revisadas")
    parser.add_argument("--only", metavar="NOMBRE", help="genera solo esta especie")
    args = parser.parse_args()

    names = [args.only] if args.only else CATALOG_SPECIES
    model = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
    return asyncio.run(build(names, args.force, model))


if __name__ == "__main__":
    sys.exit(main())
