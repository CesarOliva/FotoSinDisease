"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addPlant,
  findSavedPlant,
  useSavedPlants,
  type NewPlant,
} from "@/lib/plants-store";

/**
 * Botón "Agregar a mis plantas". Si ya existe una planta con ese nombre
 * científico, muestra el estado agregado aunque se vuelva a identificar.
 */
export function AddPlantButton({
  plantKey,
  buildPlant,
  disabled,
}: {
  plantKey: string;
  buildPlant: () => Promise<NewPlant>;
  disabled?: boolean;
}) {
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const plants = useSavedPlants();

  // `plantKey` es el nombre científico en todas las pantallas que usan el botón.
  const isSaved = Boolean(findSavedPlant(plants, plantKey));

  if (isSaved || addedKey === plantKey) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <CircleCheck className="size-4" aria-hidden />
          Agregada a tus plantas
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/recordatorios">Ver recordatorios</Link>
        </Button>
      </div>
    );
  }

  async function handleAdd() {
    setAdding(true);
    addPlant(await buildPlant());
    setAddedKey(plantKey);
    setAdding(false);
  }

  return (
    <Button size="lg" onClick={handleAdd} disabled={disabled || adding}>
      <Plus data-icon="inline-start" aria-hidden />
      Agregar a mis plantas
    </Button>
  );
}
