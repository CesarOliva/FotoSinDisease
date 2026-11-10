"""Catálogo de fichas generadas por el modelo (`backend/data/plants.json`).

Cada entrada guarda la ficha junto con su procedencia (modelo, fecha, versión
del prompt) y un indicador `reviewed` que un humano marca tras revisarla. El
catálogo se sirve antes que la caché y que Ollama.
"""

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from services.profile_cache import normalize_name

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "plants.json"
SCHEMA_VERSION = 1

logger = logging.getLogger(__name__)

_index_cache: tuple[float, dict[str, dict[str, Any]]] | None = None


def load_raw_entries(path: Path | None = None) -> list[dict[str, Any]]:
    """Lee todas las entradas del archivo tal cual. Lista vacía si no existe."""
    path = path or CATALOG_PATH
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return []
    except (OSError, ValueError) as exc:
        logger.warning("Catálogo ilegible %s: %s", path, exc)
        return []

    plants = data.get("plants") if isinstance(data, dict) else None
    if not isinstance(plants, list):
        logger.warning("Catálogo sin lista 'plants' en %s", path)
        return []
    return [entry for entry in plants if isinstance(entry, dict)]


def load_catalog(path: Path | None = None) -> dict[str, dict[str, Any]]:
    """Índice `catalogId -> entrada`, recargado solo cuando cambia el archivo."""
    global _index_cache
    path = path or CATALOG_PATH
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return {}

    if _index_cache is not None and _index_cache[0] == mtime:
        return _index_cache[1]

    index: dict[str, dict[str, Any]] = {}
    for entry in load_raw_entries(path):
        catalog_id = entry.get("catalogId")
        if isinstance(catalog_id, str) and isinstance(entry.get("profile"), dict):
            index[catalog_id] = entry

    _index_cache = (mtime, index)
    return index


def find_entry(scientific_name: str) -> dict[str, Any] | None:
    """Entrada del catálogo para un nombre científico, o None si no existe."""
    return load_catalog().get(normalize_name(scientific_name))


def catalog_id_for(scientific_name: str) -> str | None:
    entry = find_entry(scientific_name)
    return entry["catalogId"] if entry else None


def write_raw_entries(entries: list[dict[str, Any]], path: Path | None = None) -> None:
    """Escribe el catálogo de forma atómica (`temp` + `replace`)."""
    path = path or CATALOG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"schemaVersion": SCHEMA_VERSION, "plants": entries}

    fd, temp_name = tempfile.mkstemp(dir=str(path.parent), prefix=".plants.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except BaseException:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise
