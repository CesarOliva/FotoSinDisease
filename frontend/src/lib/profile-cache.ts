import { getPlantProfile } from "@/lib/api";
import type { PlantProfile } from "@/lib/types";

/**
 * Caché de fichas compartida por toda la aplicación.
 *
 * La clave combina el modelo de Ollama con el nombre científico normalizado.
 * Se apoya en `localStorage` para sobrevivir a cambios de pantalla y recargas,
 * y deduplica las peticiones que están en vuelo para no generar dos fichas de
 * la misma especie a la vez.
 */

const STORAGE_KEY = "florasense.profiles.v1";
const CACHE_MODEL = process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? "llama3.2:1b";

export const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = {
  profile: PlantProfile;
  storedAt: number;
};

type StoredCache = Record<string, CacheEntry>;

const memory = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PlantProfile | null>>();

let hydrated = false;

function normalizeName(scientificName: string) {
  return scientificName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function cacheKey(scientificName: string) {
  return `${CACHE_MODEL}|${normalizeName(scientificName)}`;
}

function isFresh(entry: CacheEntry) {
  return Date.now() - entry.storedAt < PROFILE_CACHE_TTL_MS;
}

function readStorage(): StoredCache {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;

  for (const [key, entry] of Object.entries(readStorage())) {
    if (entry?.profile && isFresh(entry)) memory.set(key, entry);
  }
}

function persist() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(memory))
    );
  } catch {
    // Sin espacio o almacenamiento bloqueado: la caché en memoria sigue viva.
  }
}

/** Devuelve la ficha cacheada o `null` si no existe (o expiró). */
export function getCachedProfile(scientificName: string): PlantProfile | null {
  hydrate();

  const key = cacheKey(scientificName);
  const entry = memory.get(key);
  if (!entry) return null;

  if (!isFresh(entry)) {
    memory.delete(key);
    return null;
  }

  return entry.profile;
}

/**
 * Obtiene una ficha de la caché o la pide al backend. Las peticiones repetidas
 * de la misma especie comparten la misma promesa en vuelo.
 */
export function requestProfile(
  scientificName: string,
  catalogId?: string
): Promise<PlantProfile | null> {
  const cached = getCachedProfile(scientificName);
  if (cached) return Promise.resolve(cached);

  const key = cacheKey(scientificName);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = getPlantProfile(scientificName, catalogId)
    .then((profile) => {
      if (profile) {
        memory.set(key, { profile, storedAt: Date.now() });
        persist();
      }
      return profile;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Calienta la caché en segundo plano; los errores se ignoran a propósito. */
export function prefetchProfile(scientificName: string, catalogId?: string) {
  if (getCachedProfile(scientificName)) return;

  void requestProfile(scientificName, catalogId).catch(() => undefined);
}

/** Vacía la caché en memoria y en `localStorage` (útil para pruebas). */
export function clearProfileCache() {
  memory.clear();
  inFlight.clear();
  hydrated = true;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorado: no hay nada que limpiar si el almacenamiento está bloqueado.
    }
  }
}
