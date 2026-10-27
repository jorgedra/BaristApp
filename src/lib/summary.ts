import type { ImportPayload } from './schema';
import { METHOD_LABELS, type Brew, type Coffee, type Recipe, type Step } from './types';
import { daysSince, formatNum, formatRatio, formatTime } from './time';
import { remainingGrams } from './stock';

const line = (label: string, value: unknown) =>
  value === undefined || value === null || value === '' ? [] : [`- ${label}: ${value}`];

export function coffeeText(c: Coffee, now = new Date(), remaining?: number): string {
  const days = c.roastDate ? daysSince(c.roastDate, now) : null;
  return [
    `### ${c.name}${c.roaster ? ` (${c.roaster})` : ''}`,
    ...line('Origen', [c.origin, c.region].filter(Boolean).join(', ')),
    ...line('Variedad', c.variety),
    ...line('Proceso', c.process),
    ...line('Tueste', c.roastLevel),
    ...line('Fecha de tueste', c.roastDate && `${c.roastDate}${days !== null ? ` (${days} días)` : ''}`),
    ...line('Notas del tostador', c.tastingNotes?.join(', ')),
    ...line('Notas', c.notes),
    ...line('Existencias', remaining !== undefined ? `≈ ${formatNum(Math.max(0, remaining))} g` : undefined),
    ...(c.inStock ? [] : ['- Sin existencias']),
  ].join('\n');
}

export function stepText(s: Step): string {
  const parts = [`${formatTime(s.at)} —`];
  if (s.addGrams !== undefined) parts.push(`+${s.addGrams} g`);
  if (s.totalGrams !== undefined) parts.push(`(acumulado ${s.totalGrams} g)`);
  if (s.endsAt !== undefined) parts.push(`hasta ${formatTime(s.endsAt)}`);
  if (s.pourType) parts.push(`[${s.pourType}]`);
  parts.push(s.instruction);
  return parts.join(' ');
}

export function recipeText(r: Recipe): string {
  const target =
    r.targetTimeMin !== undefined && r.targetTimeMax !== undefined
      ? `${formatTime(r.targetTimeMin)}–${formatTime(r.targetTimeMax)}`
      : undefined;
  return [
    `#### ${r.name}${r.isReference ? ' ★ referencia' : ''}`,
    `- Método: ${METHOD_LABELS[r.method]}`,
    `- Café: ${formatNum(r.coffeeGrams)} g · Agua: ${formatNum(r.waterGrams)} g · Ratio ${formatRatio(r.coffeeGrams, r.waterGrams)}`,
    ...line('Molienda K6', r.grindClicks !== undefined ? `${r.grindClicks} clics` : undefined),
    ...line('Temperatura', r.waterTempC !== undefined ? `${r.waterTempC} °C` : undefined),
    ...line('Filtro', r.filter),
    ...line('Accesorios', r.accessories),
    ...line('Tiempo objetivo', target),
    '- Pasos:',
    ...r.steps.map((s) => `  - ${stepText(s)}`),
    ...line('Motivo', r.rationale),
  ].join('\n');
}

export function brewText(b: Brew, r?: Recipe): string {
  const diffs: string[] = [];
  if (r) {
    if (b.coffeeGrams !== r.coffeeGrams) diffs.push(`café ${formatNum(b.coffeeGrams)} g (receta ${formatNum(r.coffeeGrams)} g)`);
    if (b.waterGrams !== r.waterGrams) diffs.push(`agua ${formatNum(b.waterGrams)} g (receta ${formatNum(r.waterGrams)} g)`);
    if (b.grindClicks !== r.grindClicks) diffs.push(`molienda ${b.grindClicks ?? '?'} clics (receta ${r.grindClicks ?? '?'})`);
    if (b.waterTempC !== r.waterTempC) diffs.push(`temperatura ${b.waterTempC ?? '?'} °C (receta ${r.waterTempC ?? '?'})`);
  }
  return [
    `- ${b.date.slice(0, 10)}${r ? ` · ${r.name}` : ''}${b.rating ? ` · ${b.rating}/5` : ''}`,
    ...(diffs.length ? [`  - Desviaciones: ${diffs.join('; ')}`] : []),
    ...(b.finalTime !== undefined ? [`  - Tiempo final: ${formatTime(b.finalTime)}`] : []),
    ...(b.change ? [`  - Cambio probado: ${b.change}`] : []),
    ...(b.taste ? [`  - Sabor: ${b.taste}`] : []),
    ...(b.problems ? [`  - Problemas: ${b.problems}`] : []),
    ...(b.notes ? [`  - Notas: ${b.notes}`] : []),
  ].join('\n');
}

/** Mensaje listo para pegar en el chat tras una preparación. */
export function brewReport(b: Brew, r: Recipe, c: Coffee): string {
  return [
    `Resultado de una preparación de ${c.name}${c.roaster ? ` (${c.roaster})` : ''} con la receta «${r.name}» (${METHOD_LABELS[r.method]}).`,
    '',
    brewText(b, r),
    '',
    'Receta usada:',
    recipeText(r),
  ].join('\n');
}

/** Resumen de estado de un café para continuar en otra conversación. */
export function coffeeSummary(c: Coffee, recipes: Recipe[], brews: Brew[], maxBrews = 8): string {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const recent = [...brews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, maxBrews);
  const ordered = [...recipes].sort((a, b) => Number(b.isReference) - Number(a.isReference));
  return [
    coffeeText(c, new Date(), remainingGrams(c, brews)),
    '',
    ordered.length ? ordered.map(recipeText).join('\n\n') : '_Sin recetas._',
    '',
    recent.length ? `Últimas preparaciones:\n${recent.map((b) => brewText(b, byId.get(b.recipeId))).join('\n')}` : '_Sin preparaciones registradas._',
  ].join('\n');
}

export function globalSummary(coffees: Coffee[], recipes: Recipe[], brews: Brew[]): string {
  const active = coffees.filter((c) => c.inStock);
  return [
    '## Estado actual de mis cafés (exportado desde BaristApp)',
    '',
    'Usa estos datos como historial: son registros reales, no los des por óptimos.',
    '',
    ...active.map((c) =>
      coffeeSummary(
        c,
        recipes.filter((r) => r.coffeeId === c.id),
        brews.filter((b) => b.coffeeId === c.id),
      ),
    ),
    ...(active.length ? [] : ['_No hay cafés con existencias._']),
  ].join('\n\n');
}

/** Receta guardada -> formato de importación (para editar o compartir). */
export function toImportPayload(c: Coffee, r: Recipe): ImportPayload {
  return {
    baristapp: 1,
    coffee: {
      name: c.name,
      roaster: c.roaster,
      origin: c.origin,
      region: c.region,
      variety: c.variety,
      process: c.process,
      roastLevel: c.roastLevel,
      roastDate: c.roastDate,
      tastingNotes: c.tastingNotes ?? [],
    },
    recipe: {
      name: r.name,
      method: r.method,
      coffeeGrams: r.coffeeGrams,
      waterGrams: r.waterGrams,
      grindClicks: r.grindClicks,
      waterTempC: r.waterTempC,
      filter: r.filter,
      accessories: r.accessories,
      targetTime:
        r.targetTimeMin !== undefined && r.targetTimeMax !== undefined
          ? { min: r.targetTimeMin, max: r.targetTimeMax }
          : undefined,
      steps: r.steps,
      rationale: r.rationale,
      adjustments: r.adjustments,
      notes: r.notes,
    },
  };
}

/** Serializa con tiempos en m:ss, que es como los escribe el LLM. */
export function payloadToJson(p: ImportPayload): string {
  const t = (s?: number) => (s === undefined ? undefined : formatTime(s));
  return JSON.stringify(
    {
      ...p,
      recipe: {
        ...p.recipe,
        targetTime: p.recipe.targetTime && { min: t(p.recipe.targetTime.min), max: t(p.recipe.targetTime.max) },
        steps: p.recipe.steps.map((s) => ({ ...s, at: t(s.at), endsAt: t(s.endsAt) })),
      },
    },
    null,
    2,
  );
}
