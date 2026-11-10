import { Info } from "lucide-react";

/** Aviso de procedencia: las fichas las genera un modelo local, no una fuente externa. */
export function ProfileNotice() {
  return (
    <p className="flex gap-2 rounded-2xl border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Ficha generada por IA local y no verificada con una fuente externa.
        Úsala como orientación general y consulta a un especialista ante dudas.
      </span>
    </p>
  );
}
