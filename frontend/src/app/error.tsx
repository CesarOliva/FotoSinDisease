"use client"; // Los error boundaries deben ser Client Components.

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert, House, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // Sin servicio de reporte: queda en la consola para depurar.
    console.error(error);
  }, [error]);

  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-destructive/30 bg-card px-6 py-12 text-center"
      role="alert"
    >
      <CircleAlert className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        No pudimos mostrar esta pantalla. Inténtalo de nuevo; si el problema
        continúa, vuelve al inicio.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw data-icon="inline-start" aria-hidden />
          Reintentar
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <House data-icon="inline-start" aria-hidden />
            Ir al inicio
          </Link>
        </Button>
      </div>
    </div>
  );
}
