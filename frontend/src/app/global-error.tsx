"use client"; // Los error boundaries deben ser Client Components.

// Reemplaza al layout raíz cuando falla, así que define su propio <html> y estilos.
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground antialiased">
        <title>Error · FotoSinDisease</title>
        <div className="max-w-md space-y-3 text-center" role="alert">
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground">
            La aplicación no pudo cargarse. Inténtalo de nuevo en unos segundos.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
