export const METHODS = ['v60', 'aeropress', 'orb', 'moka', 'other'] as const;
export type Method = (typeof METHODS)[number];

export const METHOD_LABELS: Record<Method, string> = {
  v60: 'V60',
  aeropress: 'AeroPress',
  orb: 'ORB',
  moka: 'Moka',
  other: 'Otro',
};

export const STEP_ACTIONS = ['pour', 'wait', 'stir', 'swirl', 'press', 'heat', 'remove', 'other'] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

export const STEP_ACTION_LABELS: Record<StepAction, string> = {
  pour: 'Vertido',
  wait: 'Espera',
  stir: 'Remover',
  swirl: 'Giro',
  press: 'Presionar',
  heat: 'Calor',
  remove: 'Retirar',
  other: 'Acción',
};

export interface Coffee {
  id?: number;
  name: string;
  roaster?: string;
  origin?: string;
  region?: string;
  variety?: string;
  process?: string;
  roastLevel?: string;
  /** YYYY-MM-DD */
  roastDate?: string;
  tastingNotes?: string[];
  notes?: string;
  /** false = sin existencias; se oculta del inicio */
  inStock: boolean;
  createdAt: string;
}

export interface Step {
  /** segundos desde el inicio */
  at: number;
  action: StepAction;
  /** agua añadida en este paso (g) */
  addGrams?: number;
  /** agua acumulada al terminar este paso (g) */
  totalGrams?: number;
  /** segundos; momento aproximado en que debe terminar */
  endsAt?: number;
  /** suave, continuo, circular, central... */
  pourType?: string;
  instruction: string;
}

export interface Adjustment {
  when: string;
  then: string;
}

export interface Recipe {
  id?: number;
  coffeeId: number;
  name: string;
  method: Method;
  coffeeGrams: number;
  waterGrams: number;
  grindClicks?: number;
  waterTempC?: number;
  filter?: string;
  accessories?: string;
  targetTimeMin?: number;
  targetTimeMax?: number;
  steps: Step[];
  rationale?: string;
  adjustments: Adjustment[];
  notes?: string;
  /** receta de referencia para este café + método */
  isReference: boolean;
  createdAt: string;
}

export interface Brew {
  id?: number;
  recipeId: number;
  coffeeId: number;
  date: string;
  /** parámetros reales usados (pueden diferir de la receta) */
  coffeeGrams: number;
  waterGrams: number;
  grindClicks?: number;
  waterTempC?: number;
  finalTime?: number;
  /** 1–5 */
  rating?: number;
  taste?: string;
  problems?: string;
  /** variable que se cambió respecto a la receta, si alguna */
  change?: string;
  notes?: string;
}
