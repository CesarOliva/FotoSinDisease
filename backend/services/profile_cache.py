import json
import logging
import os
import re
import tempfile
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

PROMPT_VERSION = "v3"
DEFAULT_TTL_DAYS = 30
CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"

logger = logging.getLogger(__name__)

def normalize_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-") or "plant"

def _safe_component(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-") or "default"

def _ttl() -> timedelta:
    raw = os.getenv("PROFILE_CACHE_TTL_DAYS", str(DEFAULT_TTL_DAYS))
    try:
        days = float(raw)
    except ValueError:
        days = DEFAULT_TTL_DAYS
    return timedelta(days=days)

def cache_path(model: str, normalized_name: str) -> Path:
    return CACHE_DIR / _safe_component(model) / f"{normalized_name}.json"

def read_cache(
    model: str,
    normalized_name: str,
    prompt_version: str = PROMPT_VERSION,
) -> dict[str, Any] | None:
    path = cache_path(model, normalized_name)
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as exc:
        logger.warning("Ignorando caché ilegible %s: %s", path, exc)
        return None

    if data.get("model") != model or data.get("promptVersion") != prompt_version:
        return None

    generated_at = data.get("generatedAt")
    if not isinstance(generated_at, str):
        return None
    try:
        created = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Ignorando caché con fecha inválida %s", path)
        return None
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created > _ttl():
        return None

    profile = data.get("profile")
    return profile if isinstance(profile, dict) else None

def write_cache(
    model: str,
    normalized_name: str,
    scientific_name: str,
    profile: dict[str, Any],
    prompt_version: str = PROMPT_VERSION,
) -> None:
    path = cache_path(model, normalized_name)
    path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "scientificName": scientific_name,
        "model": model,
        "promptVersion": prompt_version,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "reviewed": False,
        "profile": profile,
    }

    fd, temp_name = tempfile.mkstemp(
        dir=str(path.parent), prefix=f".{path.stem}.", suffix=".tmp"
    )
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
