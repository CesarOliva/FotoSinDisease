"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ContextStep } from "@/components/flow/context-step";
import { PhotoStep } from "@/components/flow/photo-step";
import type { Photo } from "@/components/photo/photo-slot";
import { SpeciesStep } from "@/components/flow/species-step";
import { ErrorPanel, LoadingPanel } from "@/components/flow/status-panels";
import { StepIndicator } from "@/components/flow/step-indicator";
import { ResultsView } from "@/components/results/results-view";
import {
  analyzePlant,
  ApiError,
  identifyPlant,
} from "@/lib/api";
import { getCachedProfile, requestProfile } from "@/lib/profile-cache";
import type {
  AnalysisResult,
  EnvironmentContext,
  PlantProfile,
  SelectedSpecies,
  SpeciesCandidate,
} from "@/lib/types";
import { MAX_IMAGES, validateImage } from "@/lib/validation";

type Step = 0 | 1 | 2 | 3;

type IdentifyState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; candidates: SpeciesCandidate[] };

type AnalysisState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; result: AnalysisResult };

type ProfileState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; profile: PlantProfile | null };

// Una ranura por foto permitida (ver `PhotoStep`).
const EMPTY_PHOTOS: (Photo | null)[] = Array.from({ length: MAX_IMAGES }, () => null);

const EMPTY_CONTEXT: EnvironmentContext = {
  locationType: "unknown",
  light: "unknown",
  lastWatered: "unknown",
  hasDrainage: "unknown",
};

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

export function AnalysisFlow() {
  const [step, setStep] = useState<Step>(0);
  const [photos, setPhotos] = useState(EMPTY_PHOTOS);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [identify, setIdentify] = useState<IdentifyState | null>(null);
  const [selection, setSelection] = useState("");
  const [manualName, setManualName] = useState("");
  const [context, setContext] = useState(EMPTY_CONTEXT);
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [profileStates, setProfileStates] = useState<
    Record<string, ProfileState>
  >({});
  // Permite descartar respuestas que llegan después de reiniciar el flujo.
  const requestId = useRef(0);
  const profileGeneration = useRef(0);

  const selectedPhotos = photos.filter((p): p is Photo => p !== null);
  const files = selectedPhotos.map((p) => p.file);
  const completedAnalysis =
    analysis?.status === "success" ? analysis.result : null;
  const completedProfileState = completedAnalysis
    ? profileStates[completedAnalysis.species.scientificName.trim()]
    : undefined;

  function goTo(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadProfile(
    species: Pick<SelectedSpecies, "scientificName" | "catalogId">
  ) {
    const scientificName = species.scientificName.trim();
    if (!scientificName) return;

    const generation = profileGeneration.current;
    const cached = getCachedProfile(scientificName);
    if (cached) {
      setProfileStates((previous) => ({
        ...previous,
        [scientificName]: { status: "success", profile: cached },
      }));
      return;
    }

    setProfileStates((previous) => ({
      ...previous,
      [scientificName]: { status: "loading" },
    }));
    try {
      const profile = await requestProfile(scientificName, species.catalogId);
      if (generation !== profileGeneration.current) return;
      setProfileStates((previous) => ({
        ...previous,
        [scientificName]: { status: "success", profile },
      }));
    } catch {
      if (generation !== profileGeneration.current) return;
      setProfileStates((previous) => ({
        ...previous,
        [scientificName]: { status: "error" },
      }));
    }
  }

  function handleSelectPhoto(index: number, file: File) {
    const error = validateImage(file);
    if (error) {
      setPhotoError(error);
      return;
    }
    const previous = photos[index];
    if (previous) URL.revokeObjectURL(previous.url);
    setPhotos(
      photos.map((p, i) =>
        i === index ? { file, url: URL.createObjectURL(file) } : p
      )
    );
    setPhotoError(null);
    setIdentify(null);
    requestId.current++;
    profileGeneration.current++;
    setProfileStates({});
  }

  function handleRemovePhoto(index: number) {
    const previous = photos[index];
    if (previous) URL.revokeObjectURL(previous.url);
    setPhotos(photos.map((p, i) => (i === index ? null : p)));
    setIdentify(null);
    requestId.current++;
    profileGeneration.current++;
    setProfileStates({});
  }

  async function runIdentify() {
    const id = ++requestId.current;
    profileGeneration.current++;
    setProfileStates({});
    setIdentify({ status: "loading" });
    goTo(1);
    try {
      const { candidates } = await identifyPlant(files);
      if (id !== requestId.current) return;
      setIdentify({ status: "success", candidates });
      setSelection(candidates.length > 0 ? "candidate-0" : "");
      setManualName("");
      if (candidates[0]) void loadProfile(candidates[0]);
    } catch (error) {
      if (id !== requestId.current) return;
      setIdentify({ status: "error", error: errorMessage(error) });
    }
  }

  function selectedSpecies(): SelectedSpecies {
    if (selection.startsWith("candidate-") && identify?.status === "success") {
      const candidate =
        identify.candidates[Number(selection.slice("candidate-".length))];
      return {
        scientificName: candidate.scientificName,
        commonName: candidate.commonNames[0],
        confirmed: true,
        catalogId: candidate.catalogId,
      };
    }
    if (selection === "manual") {
      return { scientificName: manualName.trim(), confirmed: true };
    }
    return { scientificName: "", confirmed: false };
  }

  function handleSelectionChange(value: string) {
    setSelection(value);
    if (value.startsWith("candidate-") && identify?.status === "success") {
      const candidate =
        identify.candidates[Number(value.slice("candidate-".length))];
      if (candidate) void loadProfile(candidate);
    }
  }

  function continueToContext() {
    void loadProfile(selectedSpecies());
    goTo(2);
  }

  async function runAnalyze() {
    const id = ++requestId.current;
    setAnalysis({ status: "loading" });
    goTo(3);

    let result: AnalysisResult;
    try {
      result = await analyzePlant(files, selectedSpecies(), context);
    } catch (error) {
      if (id === requestId.current) {
        setAnalysis({ status: "error", error: errorMessage(error) });
      }
      return;
    }
    if (id !== requestId.current) return;
    setAnalysis({ status: "success", result });
  }

  function restart() {
    requestId.current++;
    profileGeneration.current++;
    for (const photo of photos) if (photo) URL.revokeObjectURL(photo.url);
    setPhotos(EMPTY_PHOTOS);
    setPhotoError(null);
    setIdentify(null);
    setSelection("");
    setManualName("");
    setContext(EMPTY_CONTEXT);
    setAnalysis(null);
    setProfileStates({});
    goTo(0);
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 0 && (
        <PhotoStep
          photos={photos}
          error={photoError}
          onSelect={handleSelectPhoto}
          onRemove={handleRemovePhoto}
          onContinue={() =>
            identify?.status === "success" ? goTo(1) : runIdentify()
          }
        />
      )}

      {step === 1 && identify && (
        <SpeciesStep
          status={identify.status}
          photoUrl={selectedPhotos[0]?.url}
          candidates={identify.status === "success" ? identify.candidates : []}
          error={identify.status === "error" ? identify.error : null}
          selection={selection}
          manualName={manualName}
          onSelectionChange={handleSelectionChange}
          onManualNameChange={setManualName}
          onRetry={runIdentify}
          onBack={() => goTo(0)}
          onContinue={continueToContext}
        />
      )}

      {step === 2 && (
        <ContextStep
          context={context}
          onChange={setContext}
          onBack={() => goTo(1)}
          onContinue={runAnalyze}
        />
      )}

      {step === 3 && analysis?.status === "loading" && (
        <LoadingPanel
          photoUrl={selectedPhotos[0]?.url}
          title="Analizando tu planta…"
          description="Clasificamos el estado general de las hojas. La primera vez puede tardar varios minutos mientras se carga el modelo."
        />
      )}
      {step === 3 && analysis?.status === "error" && (
        <ErrorPanel message={analysis.error} onRetry={runAnalyze}>
          <Button variant="outline" onClick={() => goTo(2)}>
            Revisar datos
          </Button>
        </ErrorPanel>
      )}
      {step === 3 && completedAnalysis && (
        <ResultsView
          result={completedAnalysis}
          photos={selectedPhotos}
          context={context}
          plantProfile={
            completedAnalysis.plantProfile ??
            (completedProfileState?.status === "success"
              ? completedProfileState.profile
              : null)
          }
          profileLoading={
            !completedAnalysis.plantProfile &&
            completedProfileState?.status === "loading"
          }
          profileError={
            !completedAnalysis.plantProfile &&
            completedProfileState?.status === "error"
          }
          onRetryProfile={() => void loadProfile(completedAnalysis.species)}
          onRestart={restart}
        />
      )}
    </div>
  );
}
