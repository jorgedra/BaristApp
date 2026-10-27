import type { BaristaDB } from './db';

const MAX_SIDE = 1280;
const THUMB_SIDE = 320;
const QUALITY = 0.8;

async function resize(bitmap: ImageBitmap, maxSide: number): Promise<ArrayBuffer> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // JPEG: Safari no codifica WebP con toBlob
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  return blob.arrayBuffer();
}

/** Comprime la imagen (≈150–300 KB) y genera una miniatura; devuelve el id de la foto guardada. */
export async function savePhoto(database: BaristaDB, file: File): Promise<number> {
  const bitmap = await createImageBitmap(file);
  try {
    const [data, thumb] = await Promise.all([resize(bitmap, MAX_SIDE), resize(bitmap, THUMB_SIDE)]);
    return (await database.photos.add({ type: 'image/jpeg', data, thumb, createdAt: new Date().toISOString() })) as number;
  } finally {
    bitmap.close();
  }
}

/** Tamaño total ocupado por las fotos, en bytes. */
export async function photosSize(database: BaristaDB): Promise<{ count: number; bytes: number }> {
  let bytes = 0;
  let count = 0;
  await database.photos.each((p) => {
    count++;
    bytes += p.data.byteLength + p.thumb.byteLength;
  });
  return { count, bytes };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
}
