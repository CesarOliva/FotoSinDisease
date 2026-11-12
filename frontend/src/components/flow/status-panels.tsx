"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CircleAlert, RotateCcw, Sprout } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const SCANNER_CORNERS = [
  "top-3 left-3 rounded-tl-lg border-t-3 border-l-3",
  "top-3 right-3 rounded-tr-lg border-t-3 border-r-3",
  "bottom-3 left-3 rounded-bl-lg border-b-3 border-l-3",
  "right-3 bottom-3 rounded-br-lg border-r-3 border-b-3",
];

/** Segundos desde que se monta el componente; 0 y parado si `enabled` es false. */
function useElapsedSeconds(enabled: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return seconds;
}

function EstimatedProgress({
  elapsed,
  estimate,
}: {
  elapsed: number;
  estimate: number;
}) {
  // Nunca llega al 100 % hasta que termina de verdad: la estimación puede fallar.
  const percent = Math.min(95, Math.round((elapsed / estimate) * 100));

  return (
    <div className="w-full max-w-sm space-y-2">
      <Progress value={percent} aria-label="Progreso estimado" />
      <p className="text-xs tabular-nums text-muted-foreground">
        {elapsed} s transcurridos · estimado ~{estimate} s
      </p>
      {elapsed >= estimate && (
        <p className="text-xs text-muted-foreground">
          Sigue en curso: el modelo local funciona en CPU y puede tardar más de lo previsto.
        </p>
      )}
    </div>
  );
}

/**
 * Estado de carga. Con `photoUrl` muestra la foto con un efecto de escáner.
 * Con `estimateSeconds` muestra tiempo transcurrido y progreso frente a la estimación.
 */
export function LoadingPanel({
  title,
  description,
  photoUrl,
  estimateSeconds,
}: {
  title: string;
  description?: string;
  photoUrl?: string;
  estimateSeconds?: number;
}) {
  const timed = estimateSeconds !== undefined;
  const elapsed = useElapsedSeconds(timed);

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border bg-card px-6 py-10 text-center shadow-sm"
      role="status"
    >
      {photoUrl ? (
        <div className="relative mb-2 aspect-4/3 w-full max-w-sm overflow-hidden rounded-2xl bg-muted">
          <Image src={photoUrl} alt="" fill unoptimized className="object-cover" />
          <div className="absolute inset-0 bg-hero/20" />
          <div className="absolute inset-x-0 h-20 -translate-y-1/2 bg-linear-to-b from-transparent via-white/45 to-transparent motion-safe:animate-scan" />
          <div className="absolute inset-x-0 h-0.5 -translate-y-1/2 bg-white shadow-[0_0_14px_3px_rgb(167_243_208)] motion-safe:animate-scan" />
          {SCANNER_CORNERS.map((corner) => (
            <span key={corner} className={cn("absolute size-7 border-white", corner)} />
          ))}
        </div>
      ) : (
        <span className="flex size-16 items-center justify-center rounded-full bg-identify text-identify-foreground">
          <Sprout className="size-8 motion-safe:animate-bounce" aria-hidden />
        </span>
      )}
      <p className="font-heading text-lg font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {timed && <EstimatedProgress elapsed={elapsed} estimate={estimateSeconds} />}
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
  children,
}: {
  message: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border border-destructive/30 bg-card px-6 py-12 text-center"
      role="alert"
    >
      <CircleAlert className="size-8 text-destructive" aria-hidden />
      <p className="max-w-sm font-medium">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {children}
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reintentar
          </Button>
        )}
      </div>
    </div>
  );
}

export function StepHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="mt-1.5 text-muted-foreground">{description}</p>
    </div>
  );
}
