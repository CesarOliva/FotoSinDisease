import { useRef, useState } from "react";
import type { Photo } from "@/components/photo/photo-slot";
import { ApiError, identifyPlant } from "@/lib/api";
import {
  getCachedProfile,
  prefetchProfile,
  requestProfile,
} from "@/lib/profile-cache";
import type { PlantProfile, SpeciesCandidate } from "@/lib/types";
import { MAX_IMAGES, validateImage, validateImageCount } from "@/lib/validation";

export type IdentifyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }  
  | { status: "success"; candidates: SpeciesCandidate[] };

export type ProfileState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; profile: PlantProfile | null };

/**
 * 1–3 fotos → candidatos de Pl@ntNet → ficha del candidato elegido.
 * La primera foto identifica al instante; cada foto añadida después repite la
 * identificación con todas, porque más órganos (hoja, flor…) mejoran el resultado.
 */
export function usePlantIdentification() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [identify, setIdentify] = useState<IdentifyState>({ status: "idle" });
  const [selected, setSelected] = useState(0);
  const [profileStates, setProfileStates] = useState<Record<string, ProfileState>>(
    {}
  );
  const requestId = useRef(0);
  const requestedProfiles = useRef(new Set<string>());

  async function loadProfile(candidate: SpeciesCandidate) {
    const profileKey = candidate.scientificName;
    const cached = getCachedProfile(profileKey);

    if (cached) {
      requestedProfiles.current.add(profileKey);
      setProfileStates((prev) => {
        const current = prev[profileKey];
        if (current?.status === "success" && current.profile === cached) {
          return prev;
        }
        return { ...prev, [profileKey]: { status: "success", profile: cached } };
      });
      return;
    }

    if (requestedProfiles.current.has(profileKey)) return;

    requestedProfiles.current.add(profileKey);
    setProfileStates((prev) => ({
      ...prev,
      [profileKey]: { status: "loading" },
    }));

    try {
      const profile = await requestProfile(profileKey, candidate.catalogId);
      setProfileStates((prev) => ({
        ...prev,
        [profileKey]: { status: "success", profile },
      }));
    } catch {
      requestedProfiles.current.delete(profileKey);
      setProfileStates((prev) => ({
        ...prev,
        [profileKey]: { status: "error" },
      }));
    }
  }

  async function identifyFiles(files: File[]) {
    const id = ++requestId.current;
    setIdentify({ status: "loading" });
    setSelected(0);
    try {
      const { candidates } = await identifyPlant(files);
      if (id !== requestId.current) return;
      setIdentify({ status: "success", candidates });
      const firstCandidate = candidates[0];
      if (firstCandidate) {
        // Adelanta la generación en segundo plano solo de la primera especie:
        // las demás competirían por la CPU con la ficha que el usuario espera.
        prefetchProfile(firstCandidate.scientificName, firstCandidate.catalogId);
        void loadProfile(firstCandidate);
      }
    } catch (error) {
      if (id !== requestId.current) return;
      setIdentify({
        status: "error",
        error:
          error instanceof ApiError
            ? error.message
            : "No pudimos identificar la planta. Inténtalo de nuevo.",
      });
    }
  }

  function revokeAll() {
    for (const photo of photos) URL.revokeObjectURL(photo.url);
  }

  function setPhotosAndIdentify(next: Photo[]) {
    setPhotos(next);
    setPhotoError(null);
    void identifyFiles(next.map((p) => p.file));
  }

  /** Primera foto: reemplaza las anteriores e identifica. */
  function selectPhoto(file: File) {
    const error = validateImage(file);
    if (error) {
      setPhotoError(error);
      return;
    }
    revokeAll();
    setPhotosAndIdentify([{ file, url: URL.createObjectURL(file) }]);
  }

  /** Foto adicional (hasta `MAX_IMAGES`): repite la identificación con todas. */
  function addPhoto(file: File) {
    const error = validateImage(file) ?? validateImageCount(photos.length + 1);
    if (error) {
      setPhotoError(error);
      return;
    }
    setPhotosAndIdentify([...photos, { file, url: URL.createObjectURL(file) }]);
  }

  function removePhoto(index: number) {
    const removed = photos[index];
    if (!removed) return;
    if (photos.length === 1) {
      reset();
      return;
    }
    URL.revokeObjectURL(removed.url);
    setPhotosAndIdentify(photos.filter((_, i) => i !== index));
  }

  function choose(index: number) {
    setSelected(index);
    if (identify.status !== "success") return;
    const chosen = identify.candidates[index];
    if (chosen) void loadProfile(chosen);
  }

  function reset() {
    requestId.current++;
    revokeAll();
    setPhotos([]);
    setPhotoError(null);
    setIdentify({ status: "idle" });
    setSelected(0);
    setProfileStates({});
    requestedProfiles.current.clear();
  }

  const candidate =
    identify.status === "success" ? identify.candidates[selected] : undefined;
  const cachedProfile = candidate
    ? getCachedProfile(candidate.scientificName)
    : null;
  const profileState: ProfileState | undefined = !candidate
    ? undefined
    : cachedProfile
      ? { status: "success", profile: cachedProfile }
      : (profileStates[candidate.scientificName] ?? { status: "loading" });

  return {
    /** Foto principal (la primera); se usa para la tarjeta y la miniatura. */
    photo: photos[0] ?? null,
    photos,
    canAddPhoto: photos.length > 0 && photos.length < MAX_IMAGES,
    photoError,
    identify,
    selected,
    candidate,
    profileState,
    selectPhoto,
    addPhoto,
    removePhoto,
    choose,
    retry: () => photos.length > 0 && void identifyFiles(photos.map((p) => p.file)),
    retryProfile: () => candidate && void loadProfile(candidate),
    reset,
  };
}

export type PlantIdentification = ReturnType<typeof usePlantIdentification>;
