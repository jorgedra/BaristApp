import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteCoffee } from '../lib/db';
import { METHOD_LABELS, type Coffee } from '../lib/types';
import { coffeeSummary } from '../lib/summary';
import { daysSince, formatDate, formatNum, formatRatio } from '../lib/time';
import { ShareText } from '../components/ShareText';
import { BrewRow } from './History';

const FIELDS: [keyof Coffee, string][] = [
  ['name', 'Nombre'],
  ['roaster', 'Tostador'],
  ['origin', 'País'],
  ['region', 'Región'],
  ['variety', 'Variedad'],
  ['process', 'Proceso'],
  ['roastLevel', 'Tueste'],
  ['roastDate', 'Fecha de tueste'],
];

function CoffeeForm({ c, onDone }: { c: Coffee; onDone: () => void }) {
  const [draft, setDraft] = useState({ ...c, tastingNotesText: (c.tastingNotes ?? []).join(', ') });
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  async function save() {
    const { tastingNotesText, id, ...rest } = draft;
    const clean = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v]));
    await db.coffees.update(id!, {
      ...clean,
      name: draft.name.trim() || c.name,
      tastingNotes: tastingNotesText.split(',').map((s) => s.trim()).filter(Boolean),
    });
    onDone();
  }
  return (
    <div className="card">
      <div className="grid2">
        {FIELDS.map(([k, label]) => (
          <label key={k}>
            {label}
            <input type={k === 'roastDate' ? 'date' : 'text'} value={(draft[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>
      <label>Notas del tostador (separadas por comas)<input value={draft.tastingNotesText} onChange={(e) => set('tastingNotesText', e.target.value)} /></label>
      <label>Notas propias<textarea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
      <div className="row"><button type="button" className="primary" onClick={save}>Guardar</button><button type="button" onClick={onDone}>Cancelar</button></div>
    </div>
  );
}

export default function CoffeePage() {
  const id = Number(useParams().id) || -1; // -1: clave válida que nunca existe (NaN rompe IndexedDB)
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const coffee = useLiveQuery(async () => (await db.coffees.get(id)) ?? null, [id]);
  const recipes = useLiveQuery(() => db.recipes.where('coffeeId').equals(id).toArray(), [id]);
  const brews = useLiveQuery(() => db.brews.where('coffeeId').equals(id).reverse().sortBy('date'), [id]);

  if (coffee === undefined || !recipes || !brews) return null;
  if (coffee === null) return <p className="empty">Café no encontrado.</p>;
  const days = coffee.roastDate ? daysSince(coffee.roastDate) : null;
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  return (
    <>
      <h1>{coffee.name}</h1>
      {editing ? (
        <CoffeeForm c={coffee} onDone={() => setEditing(false)} />
      ) : (
        <div className="card stack">
          <div className="small">
            {coffee.roaster && <div><span className="muted">Tostador:</span> {coffee.roaster}</div>}
            {(coffee.origin || coffee.region) && <div><span className="muted">Origen:</span> {[coffee.origin, coffee.region].filter(Boolean).join(', ')}</div>}
            {coffee.variety && <div><span className="muted">Variedad:</span> {coffee.variety}</div>}
            {coffee.process && <div><span className="muted">Proceso:</span> {coffee.process}</div>}
            {coffee.roastLevel && <div><span className="muted">Tueste:</span> {coffee.roastLevel}</div>}
            {coffee.roastDate && <div><span className="muted">Tostado:</span> {formatDate(coffee.roastDate)}{days !== null && ` (${days} días)`}</div>}
          </div>
          {!!coffee.tastingNotes?.length && <div className="chips">{coffee.tastingNotes.map((n) => <span key={n} className="chip">{n}</span>)}</div>}
          {coffee.notes && <p className="small">{coffee.notes}</p>}
          <div className="row">
            <button type="button" onClick={() => setEditing(true)}>✎ Editar</button>
            <button type="button" onClick={() => db.coffees.update(id, { inStock: !coffee.inStock })}>
              {coffee.inStock ? 'Marcar sin existencias' : 'Marcar con existencias'}
            </button>
          </div>
        </div>
      )}

      <h2>Recetas</h2>
      {recipes.length === 0 && <p className="muted small">Sin recetas.</p>}
      {[...recipes].sort((a, b) => Number(b.isReference) - Number(a.isReference) || b.createdAt.localeCompare(a.createdAt)).map((r) => (
        <Link key={r.id} to={`/receta/${r.id}`} className="card">
          <div className="row between"><h3>{r.name}</h3>{r.isReference && <span className="chip ref">★ referencia</span>}</div>
          <div className="small muted">
            {METHOD_LABELS[r.method]} · {formatNum(r.coffeeGrams)} g / {formatNum(r.waterGrams)} g ({formatRatio(r.coffeeGrams, r.waterGrams)})
            {r.grindClicks !== undefined && ` · ${r.grindClicks} clics`}
            {r.waterTempC !== undefined && ` · ${r.waterTempC} °C`}
          </div>
        </Link>
      ))}

      <h2>Preparaciones</h2>
      {brews.length === 0 && <p className="muted small">Aún no has registrado ninguna.</p>}
      {brews.map((b) => <BrewRow key={b.id} b={b} r={recipeById.get(b.recipeId)} />)}

      <h2>Exportar</h2>
      <p className="small muted">Resumen del estado de este café para continuar en una conversación nueva con el LLM.</p>
      <ShareText label="Copiar resumen" title={coffee.name} text={() => coffeeSummary(coffee, recipes, brews)} />

      <h2>Zona peligrosa</h2>
      <button
        type="button"
        className="danger"
        onClick={async () => {
          if (confirm(`¿Borrar «${coffee.name}» con sus ${recipes.length} recetas y ${brews.length} preparaciones?`)) {
            await deleteCoffee(db, id);
            navigate('/', { replace: true });
          }
        }}
      >
        Borrar café
      </button>
    </>
  );
}
