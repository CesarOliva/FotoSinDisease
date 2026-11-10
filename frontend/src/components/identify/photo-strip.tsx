"use client";

import { useRef } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import type { Photo } from "@/components/photo/photo-slot";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES } from "@/lib/validation";

/** Miniaturas de las fotos usadas para identificar, con opción de añadir o quitar. */
export function PhotoStrip({
  photos,
  canAdd,
  onAdd,
  onRemove,
}: {
  photos: Photo[];
  canAdd: boolean;
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">
        Tus fotos ({photos.length}/{MAX_IMAGES})
        {canAdd && ": añade otra parte de la planta (hoja, flor o fruto) para afinar el resultado."}
      </p>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <div
            key={photo.url}
            className="relative size-14 overflow-hidden rounded-lg border bg-muted"
          >
            <Image
              src={photo.url}
              alt={`Tu foto ${i + 1}`}
              fill
              unoptimized
              className="object-cover"
            />
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Quitar tu foto ${i + 1}`}
                className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white outline-none hover:bg-black/80 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAdd(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Añadir otra foto"
              className="flex size-14 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed text-[11px] text-muted-foreground transition-colors outline-none hover:border-primary/60 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ImagePlus className="size-4" aria-hidden />
              Añadir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
