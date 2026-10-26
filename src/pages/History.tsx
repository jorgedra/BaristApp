import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { METHOD_LABELS, type Brew, type Recipe } from '../lib/types';
import { formatTime } from '../lib/time';

export function BrewRow({ b, r, coffeeName }: { b: Brew; r?: Recipe; coffeeName?: string }) {
  return (
    <Link to={`/preparacion/${b.id}`} className="card">
      <div className="row between">
        <span className="small muted">{new Date(b.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span>{b.rating ? '★'.repeat(b.rating) : <span className="small muted">sin valorar</span>}</span>
      </div>
      {(coffeeName || r) && (
        <div><b>{coffeeName}</b>{coffeeName && r && ' · '}{r && <span className="small">{r.name} ({METHOD_LABELS[r.method]})</span>}</div>
      )}
      <div className="small muted">
        {[b.grindClicks !== undefined && `${b.grindClicks} clics`, b.waterTempC !== undefined && `${b.waterTempC} °C`, b.finalTime !== undefined && formatTime(b.finalTime), b.change && `cambio: ${b.change}`]
          .filter(Boolean)
          .join(' · ')}
      </div>
      {b.taste && <div className="small">{b.taste}</div>}
    </Link>
  );
}

export default function History() {
  const brews = useLiveQuery(() => db.brews.orderBy('date').reverse().toArray());
  const recipes = useLiveQuery(() => db.recipes.toArray());
  const coffees = useLiveQuery(() => db.coffees.toArray());
  if (!brews || !recipes || !coffees) return null;
  const r = new Map(recipes.map((x) => [x.id, x]));
  const c = new Map(coffees.map((x) => [x.id, x.name]));
  return (
    <>
      <h1>Historial</h1>
      {brews.length === 0 && <p className="empty">Aún no hay preparaciones. Usa «Preparar» en una receta y registra el resultado al terminar.</p>}
      {brews.map((b) => <BrewRow key={b.id} b={b} r={r.get(b.recipeId)} coffeeName={c.get(b.coffeeId)} />)}
    </>
  );
}
