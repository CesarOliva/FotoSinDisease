import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto mientras se carga una pantalla: cabecera de herramienta y contenido. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando">
      <Skeleton className="h-36 w-full rounded-3xl sm:h-44" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
