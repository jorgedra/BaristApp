import type { BaristaDB } from './db';
import type { Brew, Coffee, Recipe } from './types';

/**
 * Gramos restantes: existencias registradas menos las preparaciones posteriores.
 * Se calcula en vez de guardarse para que editar o borrar una preparación lo corrija solo.
 * undefined = el café no tiene existencias registradas.
 */
export function remainingGrams(coffee: Coffee, brews: Brew[], excludeBrewId?: number): number | undefined {
  if (coffee.stockGrams === undefined) return undefined;
  const since = coffee.stockSetAt ?? '';
  const used = brews
    .filter((b) => b.coffeeId === coffee.id && b.date > since && b.id !== excludeBrewId)
    .reduce((sum, b) => sum + b.coffeeGrams, 0);
  return Math.round((coffee.stockGrams - used) * 10) / 10;
}

/** Dosis habitual del café: la de su receta de referencia o, si no hay, la de la más reciente. */
export function usualDose(recipes: Recipe[]): number | undefined {
  const sorted = [...recipes].sort((a, b) => Number(b.isReference) - Number(a.isReference) || b.createdAt.localeCompare(a.createdAt));
  return sorted[0]?.coffeeGrams;
}

export function cupsLeft(remaining: number | undefined, dose: number | undefined): number | undefined {
  if (remaining === undefined || !dose) return undefined;
  return Math.max(0, Math.floor(remaining / dose));
}

async function coffeeBrews(database: BaristaDB, coffeeId: number) {
  return database.brews.where('coffeeId').equals(coffeeId).toArray();
}

/** Marca el café con o sin existencias según lo que quede (solo si tiene existencias registradas). */
export async function syncStockFlag(database: BaristaDB, coffeeId: number) {
  const c = await database.coffees.get(coffeeId);
  if (!c) return;
  const rem = remainingGrams(c, await coffeeBrews(database, coffeeId));
  if (rem !== undefined && c.inStock !== rem > 0) await database.coffees.update(coffeeId, { inStock: rem > 0 });
}

/** Fija lo que queda (p. ej. tras pesar la bolsa). */
export async function adjustStock(database: BaristaDB, coffeeId: number, grams: number, now = new Date()) {
  await database.coffees.update(coffeeId, { stockGrams: grams, stockSetAt: now.toISOString(), inStock: grams > 0 });
}

/** Suma una bolsa nueva a lo que queda; actualiza la fecha de tueste si se indica. */
export async function addBag(database: BaristaDB, coffeeId: number, grams: number, roastDate?: string, now = new Date()) {
  const c = await database.coffees.get(coffeeId);
  if (!c) return;
  const rem = remainingGrams(c, await coffeeBrews(database, coffeeId)) ?? 0;
  await database.coffees.update(coffeeId, {
    stockGrams: Math.max(0, rem) + grams,
    stockSetAt: now.toISOString(),
    inStock: true,
    ...(roastDate && { roastDate }),
  });
}

/** Elimina el seguimiento de existencias. */
export async function clearStock(database: BaristaDB, coffeeId: number) {
  await database.coffees.update(coffeeId, { stockGrams: undefined, stockSetAt: undefined });
}
