import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { formatRatio, formatTime, parseTime } from './time';
import { checkConsistency, extractJson, parseImport } from './importer';
import { exampleJson } from './prompt';
import { timerState } from './brewTimer';
import { BaristaDB, exportBackup, restoreBackup, saveImport, setReference } from './db';
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
    expect(again.ok && again.data).toEqual(example().data);

    const report = brewReport({ recipeId, coffeeId, date: '2026-10-26T08:00:00Z', coffeeGrams: 13.7, waterGrams: 192, grindClicks: 72, waterTempC: 93, finalTime: 160, change: 'molienda', taste: 'más dulce' }, r, c);
    expect(report).toMatch(/molienda 72 clics \(receta 75\)/);
    expect(report).toMatch(/Tiempo final: 2:40/);
  });
});
