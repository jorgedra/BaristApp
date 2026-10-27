import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { formatRatio, formatTime, parseTime } from './time';
import { checkConsistency, extractJson, parseImport } from './importer';
import { exampleJson } from './prompt';
import { timerState } from './brewTimer';
import { BaristaDB, deleteAllPhotos, exportBackup, restoreBackup, saveImport, setReference } from './db';
import { addBag, adjustStock, clearStock, cupsLeft, remainingGrams, syncStockFlag, usualDose } from './stock';
import { brewReport, payloadToJson, toImportPayload } from './summary';
import type { ImportPayload } from './schema';

const example = () => {
  const r = parseImport(exampleJson());
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r;
};

describe('time', () => {
  it('parsea y formatea m:ss', () => {
    expect(parseTime('2:30')).toBe(150);
    expect(parseTime('0:05')).toBe(5);
    expect(parseTime('45')).toBe(45);
    expect(parseTime(90)).toBe(90);
    expect(parseTime('2:75')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(formatTime(150)).toBe('2:30');
    expect(formatRatio(15, 225)).toBe('1:15');
    expect(formatRatio(13.7, 192)).toBe('1:14');
    expect(formatRatio(18, 250)).toBe('1:13,9');
  });
});

describe('importer', () => {
  it('el ejemplo de la instrucción para el LLM es válido y coherente', () => {
    const r = example();
    expect(r.warnings).toEqual([]);
    expect(r.data.recipe.steps[1]).toMatchObject({ at: 40, addGrams: 75, totalGrams: 110, endsAt: 55 });
    expect(r.data.recipe.targetTime).toEqual({ min: 135, max: 170 });
    expect(r.data.coffee.variety).toBeUndefined();
  });

  it('extrae el JSON de una respuesta con texto y bloque de código', () => {
    const text = `Aquí tienes la receta.\n\n\`\`\`json\n${exampleJson()}\n\`\`\`\n\nSuerte.`;
    expect(parseImport(text).ok).toBe(true);
    expect(extractJson('bla {"a":1} bla')).toBe('{"a":1}');
    expect(extractJson('sin json')).toBeNull();
  });

  it('informa de errores de validación con su ruta', () => {
    const bad = JSON.parse(exampleJson());
    bad.recipe.method = 'chemex';
    bad.recipe.steps[0].at = '1:99';
    const r = parseImport(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith('recipe.method'))).toBe(true);
      expect(r.errors.some((e) => e.startsWith('recipe.steps.0.at'))).toBe(true);
    }
    expect(parseImport('{ roto').ok).toBe(false);
  });

  it('avisa de incoherencias en acumulados y capacidad de AeroPress', () => {
    const data = structuredClone(example().data) as ImportPayload;
    data.recipe.steps[1].totalGrams = 120;
    expect(checkConsistency(data).join('\n')).toMatch(/Paso 2: acumulado 120 g/);

    const ap = structuredClone(example().data) as ImportPayload;
    ap.recipe.method = 'aeropress';
    ap.recipe.waterGrams = 250;
    ap.recipe.steps = [{ at: 0, action: 'pour', addGrams: 250, totalGrams: 250, instruction: 'x' }];
    expect(checkConsistency(ap).join('\n')).toMatch(/AeroPress/);
  });
});

describe('timerState', () => {
  const { steps } = example().data.recipe;
  it('calcula paso actual, siguiente y cuenta atrás', () => {
    expect(timerState(steps, 0)).toMatchObject({ current: 0, untilNext: 40, pouring: true });
    expect(timerState(steps, 20)).toMatchObject({ current: 0, untilNext: 20, pouring: false });
    expect(timerState(steps, 65)).toMatchObject({ current: 2, untilNext: 20, pouring: true });
    expect(timerState(steps, 200)).toMatchObject({ current: 3, next: undefined, untilNext: undefined });
  });
});

describe('db', () => {
  it('agrupa por café, gestiona la referencia y restaura copias', async () => {
    const db = new BaristaDB(`test-${Math.random()}`);
    const data = example().data;
    const a = await saveImport(db, data);
    const b = await saveImport(db, { ...data, coffee: { ...data.coffee, name: ' yellow papayo ' } });
    expect(b.coffeeId).toBe(a.coffeeId);
    expect(await db.coffees.count()).toBe(1);

    await setReference(db, a.recipeId, true);
    await setReference(db, b.recipeId, true);
    expect((await db.recipes.get(a.recipeId))?.isReference).toBe(false);
    expect((await db.recipes.get(b.recipeId))?.isReference).toBe(true);

    await db.brews.add({ recipeId: a.recipeId, coffeeId: a.coffeeId, date: '2026-10-26T08:00:00Z', coffeeGrams: 13.7, waterGrams: 192, grindClicks: 72, waterTempC: 93, finalTime: 160, rating: 4, taste: 'dulce' });
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    await db.recipes.clear();
    await restoreBackup(db, backup);
    expect(await db.recipes.count()).toBe(2);
    expect(await db.brews.count()).toBe(1);
    await expect(restoreBackup(db, { foo: 1 })).rejects.toThrow();
  });
});

describe('summary', () => {
  it('una receta guardada se re-exporta a JSON importable equivalente', async () => {
    const db = new BaristaDB(`test-${Math.random()}`);
    const { coffeeId, recipeId } = await saveImport(db, example().data);
    const c = (await db.coffees.get(coffeeId))!;
    const r = (await db.recipes.get(recipeId))!;
    const again = parseImport(payloadToJson(toImportPayload(c, r)));
    // bagGrams solo sirve al crear el café: pasa a ser sus existencias y no se reexporta
    const { bagGrams, ...coffee } = example().data.coffee;
    expect(bagGrams).toBe(250);
    expect(again.ok && again.data).toEqual({ ...example().data, coffee });

    const report = brewReport({ recipeId, coffeeId, date: '2026-10-26T08:00:00Z', coffeeGrams: 13.7, waterGrams: 192, grindClicks: 72, waterTempC: 93, finalTime: 160, change: 'molienda', taste: 'más dulce' }, r, c);
    expect(report).toMatch(/molienda 72 clics \(receta 75\)/);
    expect(report).toMatch(/Tiempo final: 2:40/);
  });
});

describe('stock', () => {
  const brew = (coffeeId: number, date: string, coffeeGrams: number) => ({ recipeId: 1, coffeeId, date, coffeeGrams, waterGrams: 200 });

  it('calcula lo restante desde el historial y se corrige al editar o borrar', async () => {
    const db = new BaristaDB(`test-${Math.random()}`);
    const { coffeeId } = await saveImport(db, example().data);
    let c = (await db.coffees.get(coffeeId))!;
    expect(c.stockGrams).toBe(250);

    const later = new Date(Date.parse(c.stockSetAt!) + 1000).toISOString();
    const before = new Date(Date.parse(c.stockSetAt!) - 1000).toISOString();
    const b1 = await db.brews.add(brew(coffeeId, later, 15));
    await db.brews.add(brew(coffeeId, later, 13.7));
    await db.brews.add(brew(coffeeId, before, 99)); // anterior a las existencias: no cuenta
    await db.brews.add(brew(coffeeId + 1, later, 50)); // otro café
    const brews = await db.brews.toArray();
    expect(remainingGrams(c, brews)).toBe(221.3);
    expect(remainingGrams(c, brews, b1 as number)).toBe(236.3);

    await db.brews.update(b1, { coffeeGrams: 20 });
    expect(remainingGrams(c, await db.brews.toArray())).toBe(216.3);
    await db.brews.delete(b1);
    expect(remainingGrams(c, await db.brews.toArray())).toBe(236.3);
  });

  it('ajusta, suma bolsas, marca existencias y deja de seguir', async () => {
    const db = new BaristaDB(`test-${Math.random()}`);
    const { coffeeId } = await saveImport(db, example().data);
    const t0 = new Date('2026-10-01T10:00:00Z');
    await adjustStock(db, coffeeId, 20, t0);
    await db.brews.add(brew(coffeeId, '2026-10-02T10:00:00Z', 15));
    await db.brews.add(brew(coffeeId, '2026-10-03T10:00:00Z', 15));
    await syncStockFlag(db, coffeeId);
    let c = (await db.coffees.get(coffeeId))!;
    expect(remainingGrams(c, await db.brews.toArray())).toBe(-10);
    expect(c.inStock).toBe(false);

    // la bolsa nueva parte de 0 aunque el cálculo diera negativo, y actualiza el tueste
    await addBag(db, coffeeId, 250, '2026-10-20', new Date('2026-10-21T10:00:00Z'));
    c = (await db.coffees.get(coffeeId))!;
    expect(remainingGrams(c, await db.brews.toArray())).toBe(250);
    expect(c).toMatchObject({ inStock: true, roastDate: '2026-10-20' });

    await clearStock(db, coffeeId);
    c = (await db.coffees.get(coffeeId))!;
    expect(c.stockGrams).toBeUndefined();
    expect('stockSetAt' in c).toBe(false);
    expect(remainingGrams(c, [])).toBeUndefined();
  });

  it('dosis habitual y tazas', () => {
    const r = (coffeeGrams: number, isReference: boolean, createdAt: string) => ({ ...example().data.recipe, coffeeId: 1, coffeeGrams, isReference, createdAt, steps: [], adjustments: [] });
    expect(usualDose([r(15, false, '2026-10-02'), r(18, true, '2026-10-01')])).toBe(18);
    expect(usualDose([r(15, false, '2026-10-01'), r(13, false, '2026-10-02')])).toBe(13);
    expect(usualDose([])).toBeUndefined();
    expect(cupsLeft(100, 15)).toBe(6);
    expect(cupsLeft(-5, 15)).toBe(0);
    expect(cupsLeft(100, undefined)).toBeUndefined();
  });
});

describe('copia de seguridad v2 y fotos', () => {
  const photo = (n: number) => ({ type: 'image/jpeg', data: new Uint8Array([n, 1, 2, 255]).buffer, thumb: new Uint8Array([n]).buffer, createdAt: '2026-10-27' });

  async function seeded() {
    const db = new BaristaDB(`test-${Math.random()}`);
    const { coffeeId } = await saveImport(db, example().data);
    const p1 = (await db.photos.add(photo(7))) as number;
    const p2 = (await db.photos.add(photo(9))) as number;
    await db.coffees.update(coffeeId, { photoId: p1 });
    const siteId = (await db.sites.add({ name: 'Tostador X', url: 'https://x.es', kind: 'roaster', tags: ['madrid'], favorite: true, createdAt: '' })) as number;
    await db.wishlist.add({ title: 'Kalita', section: 'equipment', tags: ['filtro', 'regalo'], photoId: p2, siteId, status: 'pending', createdAt: '' });
    await db.settings.put({ key: 'photosEnabled', value: false });
    return { db, coffeeId };
  }

  it('restaura una copia completa con fotos, tiendas, lista y ajustes', async () => {
    const { db, coffeeId } = await seeded();
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    const target = new BaristaDB(`test-${Math.random()}`);
    await restoreBackup(target, backup);
    const c = (await target.coffees.get(coffeeId))!;
    const p = (await target.photos.get(c.photoId!))!;
    expect([...new Uint8Array(p.data)]).toEqual([7, 1, 2, 255]);
    expect(await target.wishlist.count()).toBe(1);
    expect(await target.sites.count()).toBe(1);
    expect((await target.settings.get('photosEnabled'))?.value).toBe(false);
    expect(((await target.wishlist.orderBy('tags').uniqueKeys()) as string[]).sort()).toEqual(['filtro', 'regalo']);
  });

  it('la copia sin fotos no deja referencias a fotos', async () => {
    const { db } = await seeded();
    const backup = JSON.parse(JSON.stringify(await exportBackup(db, false)));
    expect(backup.photos).toEqual([]);
    const target = new BaristaDB(`test-${Math.random()}`);
    await restoreBackup(target, backup);
    expect((await target.coffees.toArray()).every((c) => c.photoId === undefined)).toBe(true);
    expect((await target.wishlist.toArray()).every((w) => w.photoId === undefined)).toBe(true);
  });

  it('restaura copias v1 y vacía las tablas nuevas', async () => {
    const { db } = await seeded();
    await restoreBackup(db, { app: 'baristapp', version: 1, coffees: [], recipes: [], brews: [] });
    expect(await db.wishlist.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
  });

  it('borrar todas las fotos quita también las referencias', async () => {
    const { db } = await seeded();
    await deleteAllPhotos(db);
    expect(await db.photos.count()).toBe(0);
    expect((await db.coffees.toArray()).every((c) => !('photoId' in c))).toBe(true);
    expect((await db.wishlist.toArray()).every((w) => !('photoId' in w))).toBe(true);
  });
});
