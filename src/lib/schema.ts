import { z } from 'zod';
import { METHODS, STEP_ACTIONS } from './types';
import { parseTime } from './time';

/** Tiempo como "m:ss" o número de segundos. */
const time = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const s = parseTime(v);
    if (s === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Tiempo no válido: "${v}" (usa m:ss)` });
      return z.NEVER;
    }
    return s;
  });

const optText = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const optNum = z.number().nonnegative().nullish().transform((v) => v ?? undefined);

export const importSchema = z.object({
  baristapp: z.literal(1),
  coffee: z.object({
    name: z.string().min(1, 'El café necesita nombre'),
    roaster: optText,
    origin: optText,
    region: optText,
    variety: optText,
    process: optText,
    roastLevel: optText,
    roastDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'roastDate debe ser YYYY-MM-DD')
      .nullish()
      .transform((v) => v ?? undefined),
    tastingNotes: z.array(z.string()).nullish().transform((v) => v ?? []),
  }),
  recipe: z.object({
    name: z.string().min(1),
    method: z.enum(METHODS),
    coffeeGrams: z.number().positive(),
    waterGrams: z.number().positive(),
    grindClicks: optNum,
    waterTempC: optNum,
    filter: optText,
    accessories: optText,
    targetTime: z
      .object({ min: time, max: time })
      .nullish()
      .transform((v) => v ?? undefined),
    steps: z
      .array(
        z.object({
          at: time,
          action: z.enum(STEP_ACTIONS),
          addGrams: optNum,
          totalGrams: optNum,
          endsAt: time.nullish().transform((v) => v ?? undefined),
          pourType: optText,
          instruction: z.string().min(1),
        }),
      )
      .min(1, 'La receta necesita al menos un paso'),
    rationale: optText,
    adjustments: z
      .array(z.object({ when: z.string(), then: z.string() }))
      .nullish()
      .transform((v) => v ?? []),
    notes: optText,
  }),
});

export type ImportPayload = z.output<typeof importSchema>;
