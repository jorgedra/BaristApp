import Dexie, { type EntityTable } from 'dexie';
import type { Brew, Coffee, Recipe } from './types';
import type { ImportPayload } from './schema';

export class BaristaDB extends Dexie {
  coffees!: EntityTable<Coffee, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  brews!: EntityTable<Brew, 'id'>;

  constructor(name = 'baristapp') {
    super(name);
    this.version(1).stores({
      coffees: '++id, name, inStock, createdAt',
      recipes: '++id, coffeeId, method, createdAt',
      brews: '++id, recipeId, coffeeId, date',
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
      cid = (await database.coffees.add({
        ...coffee,
        inStock: true,
        createdAt: new Date().toISOString(),
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
  await database.transaction('rw', database.coffees, database.recipes, database.brews, async () => {
    await database.brews.where('coffeeId').equals(coffeeId).delete();
    await database.recipes.where('coffeeId').equals(coffeeId).delete();
    await database.coffees.delete(coffeeId);
  });
}

// ---- Copia de seguridad ----

export interface Backup {
  app: 'baristapp';
  version: 1;
  exportedAt: string;
  coffees: Coffee[];
  recipes: Recipe[];
  brews: Brew[];
}

export async function exportBackup(database: BaristaDB): Promise<Backup> {
  return {
    app: 'baristapp',
    version: 1,
    exportedAt: new Date().toISOString(),
    coffees: await database.coffees.toArray(),
    recipes: await database.recipes.toArray(),
    brews: await database.brews.toArray(),
  };
}

/** Sustituye todos los datos por los de la copia. */
export async function restoreBackup(database: BaristaDB, backup: unknown) {
  const b = backup as Partial<Backup>;
  if (b?.app !== 'baristapp' || b.version !== 1 || !Array.isArray(b.coffees) || !Array.isArray(b.recipes) || !Array.isArray(b.brews))
    throw new Error('El archivo no es una copia de seguridad de BaristApp válida.');
  await database.transaction('rw', database.coffees, database.recipes, database.brews, async () => {
    await Promise.all([database.coffees.clear(), database.recipes.clear(), database.brews.clear()]);
    await database.coffees.bulkAdd(b.coffees!);
    await database.recipes.bulkAdd(b.recipes!);
    await database.brews.bulkAdd(b.brews!);
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
