"use client";

import { CircleHelp, Droplets } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlantThumb } from "@/components/plants/plant-thumb";
import { StorageWarning } from "@/components/plants/storage-warning";
import { WaterBar } from "@/components/plants/water-bar";
import { CareProfile, CommonProblemsCard, PreventionCard } from "@/components/results/care-profile";
import { cn } from "cn";
import { formatAmount } from "@/lib/water";
import {
  daysUntilWatering,
  plantName,
  todayISO,
  updatePlant,
  useSavedPlants,
  wateringLabel,
} from "@/lib/plants-store";

export function SavedPlantDetails({ id }: { id: string }) {
  const plant = useSavedPlants().find((savedPlant) => savedPlant.id === id);

  if (!plant) {
    return (
      <section className="space-y-5">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CircleHelp className="size-8 text-muted-foreground" aria-hidden />
            <h1 className="font-heading text-xl font-semibold">No encontramos esta planta</h1>
            <p className="text-sm text-muted-foreground">
              Puede que se haya quitado de tus plantas guardadas.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const name = plantName(plant);
  const profile = plant.profile;
  const days = daysUntilWatering(plant);
  const due = days !== null && days <= 0;
  const wateredToday = plant.lastWateredAt === todayISO();

  return (
    <section className="space-y-6">
      <StorageWarning />
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 sm:flex">
        <div className="sm:w-64 sm:shrink-0">
          <PlantThumb
            src={plant.photo}
            alt={name}
            className="aspect-4/3 w-full rounded-none sm:aspect-auto sm:h-full sm:min-h-56"
          />
        </div>
        <div className="flex-1 space-y-4 p-4 sm:p-6">
          <div>
            <Badge variant="secondary">Planta guardada</Badge>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {name}
            </h1>
            {plant.commonName && (
              <p className="text-muted-foreground">
                <i>{plant.scientificName}</i>
                {profile?.commonNames?.length
                  ? ` · ${profile.commonNames.filter((n) => n !== plant.commonName).join(", ")}`
                  : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                due
                  ? "bg-warning text-warning-foreground"
                  : days === null
                    ? "bg-muted text-muted-foreground"
                    : "bg-success text-success-foreground"
              )}
            >
              {wateringLabel(days)}
            </Badge>
            {plant.waterAmountMl && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Droplets className="size-3" aria-hidden />≈ {formatAmount(plant.waterAmountMl)}
              </span>
            )}
          </div>
          <WaterBar plant={plant} className="max-w-48" />
          <Button
            variant={due || days === null ? "default" : "outline"}
            disabled={wateredToday}
            onClick={() => updatePlant(plant.id, { lastWateredAt: todayISO() })}
          >
            <Droplets data-icon="inline-start" aria-hidden />
            {wateredToday ? "Regada hoy" : "La regué hoy"}
          </Button>
        </div>
      </div>

      {profile ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <CareProfile profile={profile} />
          <div className="space-y-6">
            {profile.commonProblems && profile.commonProblems.length > 0 && (
              <CommonProblemsCard problems={profile.commonProblems} />
            )}
            {profile.prevention.length > 0 && (
              <PreventionCard tips={profile.prevention} />
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Aún no hay una ficha de cuidados guardada para esta planta.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
