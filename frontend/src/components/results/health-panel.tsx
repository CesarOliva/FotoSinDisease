import { HeartPulse, Info, ShieldCheck } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  healthStatusLabels,
  severityLabels,
  symptomLabels,
} from "@/lib/labels";
import type {
  AnalysisResult,
  HealthStatus,
  Severity,
} from "@/lib/types";

export const healthStatusClass: Record<HealthStatus, string> = {
  no_obvious_issues: "bg-success text-success-foreground",
  review_needed: "bg-warning text-warning-foreground",
  insufficient_evidence: "bg-muted text-muted-foreground",
};

const severityClass: Record<Severity, string> = {
  mild: "bg-secondary text-secondary-foreground",
  moderate: "bg-warning text-warning-foreground",
  high: "bg-destructive/10 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

export function HealthPanel({
  health,
  prevention,
  preventionLoading,
}: {
  health: AnalysisResult["health"];
  prevention: string[];
  preventionLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HeartPulse className="size-5 text-primary" aria-hidden />
          Estado de salud
        </CardTitle>
        <CardAction>
          <Badge className={healthStatusClass[health.status]}>
            {healthStatusLabels[health.status]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        {health.modelPrediction && (
          <div className="rounded-lg border p-3">
            <p className="font-medium">
              Estado estimado:{" "}
              {health.modelPrediction.condition === "healthy"
                ? "Sana"
                : "Deteriorada"}
            </p>
          </div>
        )}
        {health.symptoms.length > 0 ? (
          <ul className="space-y-3">
            {health.symptoms.map((symptom, i) => (
              <li key={i} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {symptomLabels[symptom.type]}
                  </span>
                  <Badge className={cn(severityClass[symptom.severity])}>
                    {severityLabels[symptom.severity]}
                  </Badge>
                </div>
                <p className="mt-1">{symptom.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dónde se ve: {symptom.visibleEvidence}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            {health.modelPrediction
              ? "El clasificador estima el estado general, pero no identifica síntomas concretos."
              : "No se observaron síntomas visibles en las fotos."}
          </p>
        )}

        {health.possibleCauses.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-sm font-medium">
              Posibles causas{" "}
              <span className="font-normal text-muted-foreground">
                (hipótesis)
              </span>
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              {health.possibleCauses.map((cause) => (
                <li key={cause}>{cause}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {health.disclaimer}
        </p>
        <div className="border-t pt-5">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              Prevención de enfermedades
            </h3>
            {prevention.length > 0 ? (
              <ul className="space-y-2.5">
                {prevention.map((tip) => (
                  <li key={tip} className="flex gap-2.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {tip}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                {preventionLoading
                  ? "Cargando recomendaciones de prevención de la ficha botánica…"
                  : "No hay recomendaciones de prevención disponibles para esta especie."}
              </p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
