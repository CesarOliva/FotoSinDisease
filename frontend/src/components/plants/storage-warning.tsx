"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePlantsPersistFailed } from "@/lib/plants-store";

/** Aviso cuando el último cambio en "Mis plantas" no se pudo guardar en el navegador. */
export function StorageWarning({ className }: { className?: string }) {
  const failed = usePlantsPersistFailed();
  if (!failed) return null;

  return (
    <Alert className={className} role="alert">
      <TriangleAlert aria-hidden />
      <AlertTitle>No pudimos guardar los cambios en este dispositivo</AlertTitle>
      <AlertDescription>
        El almacenamiento del navegador está lleno o bloqueado. Tus cambios se
        mantienen mientras la página siga abierta, pero se perderán al cerrarla.
        Elimina plantas que ya no uses o libera espacio y vuelve a intentarlo.
      </AlertDescription>
    </Alert>
  );
}
