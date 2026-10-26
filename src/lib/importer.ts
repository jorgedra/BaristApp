import { importSchema, type ImportPayload } from './schema';
import { formatTime } from './time';

export type ParseResult =
  | { ok: true; data: ImportPayload; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * El LLM suele envolver el JSON en texto o en un bloque ```json.
 * Prioriza el bloque marcado; si no, el primer `{` hasta el último `}`.
 */
export function extractJson(text: string): string | null {
  const fence = /^```(?:json)?[ \t]*\n([\s\S]*?)^```/im.exec(text);
  if (fence && fence[1].includes('{')) return fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function parseImport(text: string): ParseResult {
  const raw = extractJson(text);
  if (!raw) return { ok: false, errors: ['No encuentro ningún bloque JSON en el texto pegado.'] };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, errors: [`JSON mal formado: ${(e as Error).message}`] };
  }

  const result = importSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`),
    };
  }
  return { ok: true, data: result.data, warnings: checkConsistency(result.data) };
}

/** Comprobaciones que no bloquean la importación pero conviene revisar. */
export function checkConsistency({ recipe }: ImportPayload): string[] {
  const warnings: string[] = [];
  let prevAt = -1;
  let acc = 0;
  let lastTotal: number | undefined;

  recipe.steps.forEach((s, i) => {
    const n = i + 1;
    if (s.at < prevAt) warnings.push(`Paso ${n}: empieza en ${formatTime(s.at)}, antes que el paso anterior.`);
    prevAt = s.at;
    if (s.endsAt !== undefined && s.endsAt < s.at)
      warnings.push(`Paso ${n}: termina (${formatTime(s.endsAt)}) antes de empezar.`);
    if (s.addGrams !== undefined) {
      acc += s.addGrams;
      if (s.totalGrams !== undefined && Math.abs(s.totalGrams - acc) > 1)
        warnings.push(`Paso ${n}: acumulado ${s.totalGrams} g, pero la suma de vertidos da ${acc} g.`);
    }
    if (s.totalGrams !== undefined) {
      if (lastTotal !== undefined && s.totalGrams < lastTotal)
        warnings.push(`Paso ${n}: el acumulado baja de ${lastTotal} g a ${s.totalGrams} g.`);
      lastTotal = s.totalGrams;
      acc = s.totalGrams;
    }
  });

  // En AeroPress se puede diluir tras la extracción: no es un error que el último acumulado sea menor.
  if (lastTotal !== undefined && recipe.method !== 'aeropress' && Math.abs(lastTotal - recipe.waterGrams) > 1)
    warnings.push(`El último acumulado (${lastTotal} g) no coincide con el agua total (${recipe.waterGrams} g).`);

  if (recipe.method === 'aeropress' && lastTotal !== undefined && lastTotal > 200)
    warnings.push(`AeroPress: ${lastTotal} g dentro de la cámara supera la capacidad habitual (~200 g).`);

  if (recipe.targetTime && recipe.targetTime.min > recipe.targetTime.max)
    warnings.push('El tiempo objetivo mínimo es mayor que el máximo.');

  return warnings;
}
