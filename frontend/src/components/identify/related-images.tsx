import Image from "next/image";
import type { RelatedImage } from "@/lib/types";

const MAX_SHOWN = 3;

// Órganos que devuelve Pl@ntNet.
const ORGAN_LABELS: Record<string, string> = {
  leaf: "Hoja",
  flower: "Flor",
  fruit: "Fruto",
  bark: "Corteza",
  habit: "Planta completa",
  other: "Otra parte",
};

function organLabel(organ?: string | null) {
  return organ ? (ORGAN_LABELS[organ] ?? organ) : null;
}

/** Crédito obligatorio para las fotos con licencia CC de Pl@ntNet. */
function credit(image: RelatedImage) {
  return [
    organLabel(image.organ),
    image.author ? `© ${image.author}` : null,
    image.license ? image.license.toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Fotos de referencia de la especie, para compararlas con la planta del usuario. */
export function RelatedImages({
  images,
  name,
  className,
}: {
  images?: RelatedImage[];
  name: string;
  className?: string;
}) {
  const shown = (images ?? []).slice(0, MAX_SHOWN);
  if (shown.length === 0) return null;

  return (
    <div className={className}>
      <p className="mb-1.5 text-xs text-muted-foreground">
        Fotos de referencia de <i>{name}</i> en Pl@ntNet: compáralas con tu planta.
      </p>
      <ul className="grid max-w-sm grid-cols-3 gap-2">
        {shown.map((image, i) => {
          const label = organLabel(image.organ);
          const text = credit(image);
          return (
            <li key={image.url} className="min-w-0">
              <a
                href={image.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="relative block aspect-square bg-muted">
                  <Image
                    src={image.url}
                    alt={`${name}: ${label ?? "referencia"} ${i + 1} (abre la imagen original)`}
                    fill
                    unoptimized
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </span>
              </a>
              {text && (
                <p className="mt-1 truncate text-[11px] text-muted-foreground" title={text}>
                  {text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
