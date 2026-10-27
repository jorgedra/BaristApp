import Dexie, { type EntityTable } from 'dexie';
import type { Brew, Coffee, Photo, Recipe, Setting, Site, WishItem } from './types';
import type { ImportPayload } from './schema';

export class BaristaDB extends Dexie {
  coffees!: EntityTable<Coffee, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  brews!: EntityTable<Brew, 'id'>;
  wishlist!: EntityTable<WishItem, 'id'>;
  sites!: EntityTable<Site, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'baristapp') {
    super(name);
    this.version(1).stores({
      coffees: '++id, name, inStock, createdAt',
      recipes: '++id, coffeeId, method, createdAt',
      brews: '++id, recipeId, coffeeId, date',
    });
    // v2: tablas nuevas; los campos nuevos de cafés son opcionales y no necesitan migración
    this.version(2).stores({
      wishlist: '++id, section, status, createdAt, *tags',
      sites: '++id, name, kind, *tags',
      photos: '++id',
      settings: 'key',
    });
  }
}

export const db = new BaristaDB();

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/** Café con el mismo nombre y tostador, si ya existe. */
export async function findCoffee(database: BaristaDB, name: string, roaster?: string) {
  const all = await database.coffees.toArray();
  return all.find((c) => norm(c.name) === norm(name) && norm(c.roaster) === norm(roaster));
}

/**
 * Guarda una receta importada. Si `coffeeId` es undefined se busca el café por nombre+tostador
 * y, si no existe, se crea. Devuelve los ids resultantes.
 */
export async function saveImport(
  database: BaristaDB,
  { coffee, recipe }: ImportPayload,
  coffeeId?: number,
): Promise<{ coffeeId: number; recipeId: number }> {
  return database.transaction('rw', database.coffees, database.recipes, async () => {
    let cid = coffeeId ?? (await findCoffee(database, coffee.name, coffee.roaster))?.id;
    if (cid === undefined) {
      const { bagGrams, ...fields } = coffee;
      const now = new Date().toISOString();
      cid = (await database.coffees.add({
        ...fields,
        inStock: true,
        ...(bagGrams !== undefined && { stockGrams: bagGrams, stockSetAt: now }),
        createdAt: now,
      })) as number;
    }
    const { targetTime, ...rest } = recipe;
    const recipeId = (await database.recipes.add({
      ...rest,
      coffeeId: cid,
      targetTimeMin: targetTime?.min,
      targetTimeMax: targetTime?.max,
      isReference: false,
      createdAt: new Date().toISOString(),
    })) as number;
    return { coffeeId: cid, recipeId };
  });
}

/** Marca una receta como referencia y desmarca las demás del mismo café y método. */
export async function setReference(database: BaristaDB, recipeId: number, value: boolean) {
  await database.transaction('rw', database.recipes, async () => {
    const r = await database.recipes.get(recipeId);
    if (!r) return;
    if (value) {
      await database.recipes
        .where('coffeeId')
        .equals(r.coffeeId)
        .filter((o) => o.method === r.method && o.id !== recipeId)
        .modify({ isReference: false });
    }
    await database.recipes.update(recipeId, { isReference: value });
  });
}

export async function deleteRecipe(database: BaristaDB, recipeId: number) {
  await database.transaction('rw', database.recipes, database.brews, async () => {
    await database.brews.where('recipeId').equals(recipeId).delete();
    await database.recipes.delete(recipeId);
  });
}

export async function deleteCoffee(database: BaristaDB, coffeeId: number) {
  await database.transaction('rw', [database.coffees, database.recipes, database.brews, database.photos], async () => {
    const c = await database.coffees.get(coffeeId);
    if (c?.photoId !== undefined) await database.photos.delete(c.photoId);
    await database.brews.where('coffeeId').equals(coffeeId).delete();
    await database.recipes.where('coffeeId').equals(coffeeId).delete();
    await database.coffees.delete(coffeeId);
  });
}

/** Borra todas las fotos y las referencias a ellas (libera espacio). */
export async function deleteAllPhotos(database: BaristaDB) {
  await database.transaction('rw', [database.photos, database.coffees, database.wishlist], async () => {
    await database.photos.clear();
    await database.coffees.toCollection().modify((c) => void delete c.photoId);
    await database.wishlist.toCollection().modify((w) => void delete w.photoId);
  });
}

// ---- Ajustes ----

export const SETTING_DEFAULTS = {
  /** false: no se muestran ni se piden fotos (se conservan salvo que se borren) */
  photosEnabled: true,
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(database: BaristaDB, key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const row = await database.settings.get(key);
  return (row?.value as (typeof SETTING_DEFAULTS)[K] | undefined) ?? SETTING_DEFAULTS[key];
}

export async function setSetting<K extends SettingKey>(database: BaristaDB, key: K, value: (typeof SETTING_DEFAULTS)[K]) {
  await database.settings.put({ key, value });
}

// ---- Copia de seguridad ----

interface BackupPhoto {
  id: number;
  type: string;
  /** base64 */
  data: string;
  thumb: string;
  createdAt: string;
}

export interface Backup {
  app: 'baristapp';
  version: 2;
  exportedAt: string;
  includesPhotos: boolean;
  coffees: Coffee[];
  recipes: Recipe[];
  brews: Brew[];
  wishlist: WishItem[];
  sites: Site[];
  settings: Setting[];
  photos: BackupPhoto[];
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const withoutPhoto = <T extends { photoId?: number }>(x: T): T => {
  const { photoId: _drop, ...rest } = x;
  return rest as T;
};

export async function exportBackup(database: BaristaDB, includePhotos = true): Promise<Backup> {
  const [coffees, wishlist] = await Promise.all([database.coffees.toArray(), database.wishlist.toArray()]);
  return {
    app: 'baristapp',
    version: 2,
    exportedAt: new Date().toISOString(),
    includesPhotos: includePhotos,
    // Sin fotos se quitan también las referencias: al restaurar, ids nuevos podrían apuntar a fotos ajenas.
    coffees: includePhotos ? coffees : coffees.map(withoutPhoto),
    recipes: await database.recipes.toArray(),
    brews: await database.brews.toArray(),
    wishlist: includePhotos ? wishlist : wishlist.map(withoutPhoto),
    sites: await database.sites.toArray(),
    settings: await database.settings.toArray(),
    photos: includePhotos
      ? (await database.photos.toArray()).map((p) => ({ id: p.id!, type: p.type, data: toBase64(p.data), thumb: toBase64(p.thumb), createdAt: p.createdAt }))
      : [],
  };
}

/** Sustituye todos los datos por los de la copia. Acepta copias v1 (sin lista de deseos, tiendas ni fotos). */
export async function restoreBackup(database: BaristaDB, backup: unknown) {
  const b = backup as Partial<Omit<Backup, 'version'>> & { version?: number };
  const arrays = ['coffees', 'recipes', 'brews'] as const;
  if (b?.app !== 'baristapp' || (b.version !== 1 && b.version !== 2) || arrays.some((k) => !Array.isArray(b[k])))
    throw new Error('El archivo no es una copia de seguridad de BaristApp válida.');
  const photos = (b.photos ?? []).map((p) => ({ id: p.id, type: p.type, data: fromBase64(p.data), thumb: fromBase64(p.thumb), createdAt: p.createdAt }));
  const photoIds = new Set(photos.map((p) => p.id));
  const fix = <T extends { photoId?: number }>(x: T) => (x.photoId !== undefined && !photoIds.has(x.photoId) ? withoutPhoto(x) : x);
  const tables = [database.coffees, database.recipes, database.brews, database.wishlist, database.sites, database.photos, database.settings];
  await database.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await database.coffees.bulkAdd(b.coffees!.map(fix));
    await database.recipes.bulkAdd(b.recipes!);
    await database.brews.bulkAdd(b.brews!);
    await database.wishlist.bulkAdd((b.wishlist ?? []).map(fix));
    await database.sites.bulkAdd(b.sites ?? []);
    await database.settings.bulkAdd(b.settings ?? []);
    await database.photos.bulkAdd(photos);
  });
}

/** Sustituye los datos de una receta existente (conserva café, referencia y fecha). */
export async function updateRecipe(database: BaristaDB, recipeId: number, recipe: ImportPayload['recipe']) {
  const { targetTime, ...rest } = recipe;
  await database.recipes.update(recipeId, {
    ...rest,
    targetTimeMin: targetTime?.min,
    targetTimeMax: targetTime?.max,
  });
}
