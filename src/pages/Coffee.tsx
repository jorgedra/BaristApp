import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteCoffee } from '../lib/db';
import { METHOD_LABELS } from '../lib/types';
import { CoffeeForm } from '../components/CoffeeForm';
import { LinkButton, PhotoView, replacePhoto } from '../components/Fields';
import { StockCard } from '../components/StockBits';
import { remainingGrams, usualDose } from '../lib/stock';
import { coffeeSummary } from '../lib/summary';
import { daysSince, formatDate, formatNum, formatRatio } from '../lib/time';
import { ShareText } from '../components/ShareText';
import { BrewRow } from './History';

export default function CoffeePage() {
  const id = Number(useParams().id) || -1; // -1: clave válida que nunca existe (NaN rompe IndexedDB)
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const coffee = useLiveQuery(async () => (await db.coffees.get(id)) ?? null, [id]);
  const recipes = useLiveQuery(() => db.recipes.where('coffeeId').equals(id).toArray(), [id]);
  const brews = useLiveQuery(() => db.brews.where('coffeeId').equals(id).reverse().sortBy('date'), [id]);
  const roasterSite = useLiveQuery(async () => {
    const roaster = coffee?.roaster?.trim().toLowerCase();
    if (!roaster) return null;
    return (await db.sites.filter((s) => s.name.trim().toLowerCase() === roaster).first()) ?? null;
  }, [coffee?.roaster]);

  if (coffee === undefined || !recipes || !brews) return null;
  if (coffee === null) return <p className="empty">Café no encontrado.</p>;
  const days = coffee.roastDate ? daysSince(coffee.roastDate) : null;
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  return (
    <>
      <h1>{coffee.name}</h1>
      {editing ? (
        <CoffeeForm
          initial={coffee}
          onCancel={() => setEditing(false)}
          onSave={async (fields) => {
            await replacePhoto(coffee.photoId, fields.photoId);
            // Dexie borra las claves con valor undefined (p. ej. photoId al quitar la foto)
            await db.coffees.update(id, { ...fields, name: fields.name || coffee.name });
            setEditing(false);
          }}
        />
      ) : (
        <div className="card stack">
          <PhotoView photoId={coffee.photoId} />
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
            {roasterSite && <LinkButton url={roasterSite.url} label="Comprar de nuevo" />}
          </div>
        </div>
      )}

      <h2>Existencias</h2>
      <StockCard coffee={coffee} remaining={remainingGrams(coffee, brews)} dose={usualDose(recipes)} />

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
