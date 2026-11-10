import type { Metadata } from "next";
import Link from "next/link";
import { House, ScanSearch } from "lucide-react";
import { PottedPlant } from "@/components/illustrations";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <PottedPlant className="size-32" />
      <h1 className="font-heading text-xl font-semibold">
        No encontramos esta página
      </h1>
      <p className="text-sm text-muted-foreground">
        Puede que el enlace esté mal escrito o que la página ya no exista.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">
            <House data-icon="inline-start" aria-hidden />
            Ir al inicio
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/identificar">
            <ScanSearch data-icon="inline-start" aria-hidden />
            Identificar una planta
          </Link>
        </Button>
      </div>
    </div>
  );
}
