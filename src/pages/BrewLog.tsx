import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Brew } from '../lib/types';
import { formatTime, parseTime } from '../lib/time';
import { brewReport } from '../lib/summary';
import { ShareText } from '../components/ShareText';

type Draft = Record<'coffeeGrams' | 'waterGrams' | 'grindClicks' | 'waterTempC' | 'finalTime' | 'taste' | 'problems' | 'change' | 'notes', string> & { rating: number };

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : undefined;
};
const str = (v?: number) => (v === undefined ? '' : String(v));

function toDraft(b: Partial<Brew>): Draft {
  return {
    coffeeGrams: str(b.coffeeGrams),
    waterGrams: str(b.waterGrams),
    grindClicks: str(b.grindClicks),
    waterTempC: str(b.waterTempC),
    finalTime: b.finalTime === undefined ? '' : formatTime(b.finalTime),
    rating: b.rating ?? 0,
    taste: b.taste ?? '',
    problems: b.problems ?? '',
    change: b.change ?? '',
    notes: b.notes ?? '',
  };
}

export default function BrewLog() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const brewId = params.brewId ? Number(params.brewId) || -1 : undefined;

  const brew = useLiveQuery(async () => (brewId !== undefined ? ((await db.brews.get(brewId)) ?? null) : null), [brewId]);
  // Con /preparacion/:brewId el id de receta sale de la preparación; hasta que cargue no hay que consultar.
  const recipeId = brew ? brew.recipeId : brewId === undefined ? Number(params.id) : NaN;
  const recipe = useLiveQuery(async () => (Number.isFinite(recipeId) ? db.recipes.get(recipeId) : undefined), [recipeId]);
  const coffee = useLiveQuery(async () => (recipe ? db.coffees.get(recipe.coffeeId) : undefined), [recipe]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  // Inicializa el formulario una vez cargados los datos: desde la preparación existente o desde la receta.
  useEffect(() => {
    if (draft || !recipe || brew === undefined) return;
    if (brew) setDraft(toDraft(brew));
    else {
      const t = search.get('t');
      setDraft(toDraft({ ...recipe, id: undefined, notes: undefined, finalTime: t ? Number(t) : undefined }));
    }
  }, [brew, recipe, draft, search]);

  if (!recipe || !coffee || !draft) return null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const current: Brew = {
    id: brewId,
    recipeId: recipe.id!,
    coffeeId: recipe.coffeeId,
    date: brew?.date ?? new Date().toISOString(),
    coffeeGrams: num(draft.coffeeGrams) ?? recipe.coffeeGrams,
    waterGrams: num(draft.waterGrams) ?? recipe.waterGrams,
    grindClicks: num(draft.grindClicks),
    waterTempC: num(draft.waterTempC),
    finalTime: parseTime(draft.finalTime) ?? undefined,
    rating: draft.rating || undefined,
    taste: draft.taste.trim() || undefined,
    problems: draft.problems.trim() || undefined,
    change: draft.change.trim() || undefined,
    notes: draft.notes.trim() || undefined,
  };

  async function save() {
    if (brewId !== undefined) {
      await db.brews.put(current);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      const { id: _omit, ...rest } = current;
      const newId = await db.brews.add(rest);
      navigate(`/preparacion/${newId}`, { replace: true });
    }
  }

  const field = (k: 'coffeeGrams' | 'waterGrams' | 'grindClicks' | 'waterTempC', label: string) => (
    <label>
      {label}
      <input inputMode="decimal" value={draft[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <>
      <Link to={`/receta/${recipe.id}`} className="small">← {recipe.name}</Link>
      <h1>{brewId !== undefined ? 'Preparación' : 'Registrar preparación'}</h1>
      <p className="small muted">{coffee.name}{brew && ` · ${new Date(brew.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}`}</p>

      <div className="card">
        <div className="small muted" style={{ marginBottom: 8 }}>Parámetros reales (cambia solo lo que hayas modificado respecto a la receta)</div>
        <div className="grid2">
          {field('coffeeGrams', 'Café (g)')}
          {field('waterGrams', 'Agua (g)')}
          {field('grindClicks', 'Molienda (clics K6)')}
          {field('waterTempC', 'Temperatura (°C)')}
        </div>
        <label>Tiempo final (m:ss)<input inputMode="numeric" value={draft.finalTime} placeholder="2:45" onChange={(e) => set('finalTime', e.target.value)} /></label>
        <label>Variable cambiada respecto a la receta<input value={draft.change} placeholder="p. ej. molienda 75 → 72 clics" onChange={(e) => set('change', e.target.value)} /></label>
      </div>

      <div className="card">
        <label>Valoración</label>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={n <= draft.rating ? 'on' : ''} onClick={() => set('rating', n === draft.rating ? 0 : n)} aria-label={`${n} de 5`}>★</button>
          ))}
        </div>
        <label>Sabor en taza<textarea value={draft.taste} placeholder="Dulzor, acidez, cuerpo, claridad, retrogusto…" onChange={(e) => set('taste', e.target.value)} /></label>
        <label>Problemas detectados<textarea style={{ minHeight: 70 }} value={draft.problems} placeholder="Amargo, astringente, flojo, drenado lento…" onChange={(e) => set('problems', e.target.value)} /></label>
        <label>Otras notas<textarea style={{ minHeight: 70 }} value={draft.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      </div>

      <button type="button" className="primary block" onClick={save}>{saved ? '✓ Guardado' : 'Guardar'}</button>

      {brewId !== undefined && (
        <>
          <h2>Enviar al LLM</h2>
          <p className="small muted">Copia el resultado con la receta usada para pedir el diagnóstico o el siguiente ajuste.</p>
          <ShareText label="Copiar resultado" title="Resultado de preparación" text={() => brewReport(current, recipe, coffee)} />
          <h2>Zona peligrosa</h2>
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (confirm('¿Borrar esta preparación?')) {
                await db.brews.delete(brewId);
                navigate(`/receta/${recipe.id}`, { replace: true });
              }
            }}
          >
            Borrar preparación
          </button>
        </>
      )}
    </>
  );
}
