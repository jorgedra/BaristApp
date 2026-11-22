import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SETTING_DEFAULTS, type SettingKey } from './db';

export function useSetting<K extends SettingKey>(key: K): (typeof SETTING_DEFAULTS)[K] {
  const row = useLiveQuery(() => db.settings.get(key), [key]);
  return (row?.value as (typeof SETTING_DEFAULTS)[K] | undefined) ?? SETTING_DEFAULTS[key];
}

/** URL temporal de una foto (o su miniatura). No carga nada si las fotos están desactivadas. */
export function usePhotoUrl(photoId: number | undefined, variant: 'data' | 'thumb' = 'thumb'): string | undefined {
  const enabled = useSetting('photosEnabled');
  const photo = useLiveQuery(async () => (enabled && photoId !== undefined ? db.photos.get(photoId) : undefined), [enabled, photoId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!photo) return setUrl(undefined);
    const u = URL.createObjectURL(new Blob([photo[variant]], { type: photo.type }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo, variant]);
  return url;
}

/** Todas las etiquetas usadas en una tabla, para autocompletar. */
export function useAllTags(table: 'wishlist' | 'sites'): string[] {
  return useLiveQuery(async () => (await db[table].orderBy('tags').uniqueKeys()) as string[], [table]) ?? [];
}

/** Nombres de agua ya usados en recetas y preparaciones, para autocompletar. */
export function useKnownWaters(): string[] {
  return (
    useLiveQuery(async () => {
      const [recipes, brews] = await Promise.all([db.recipes.toArray(), db.brews.toArray()]);
      const names = [...recipes.map((r) => r.water?.name), ...brews.map((b) => b.water)];
      return [...new Set(names.filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b, 'es'));
    }) ?? []
  );
}
