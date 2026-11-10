export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];
/** Fotos por análisis o identificación (mismo límite que el backend). */
export const MAX_IMAGES = 3;
export const MAX_UPLOAD_SIZE_MB = Number( process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB ?? 5 );

export function validateImage(file: File): string | null {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        return `"${file.name}" no es una imagen admitida. Usa JPG o PNG.`;
    }
    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
        return `"${file.name}" pesa más de ${MAX_UPLOAD_SIZE_MB} MB.`;
    }
    return null;
}

/** Comprueba que haya entre 1 y `MAX_IMAGES` fotos. */
export function validateImageCount(count: number): string | null {
    if (count < 1) return "Añade al menos una foto de la planta.";
    if (count > MAX_IMAGES) return `Puedes usar como máximo ${MAX_IMAGES} fotos.`;
    return null;
}
