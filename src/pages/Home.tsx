import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { METHOD_LABELS, type Coffee, type Recipe } from '../lib/types';
import { daysSince } from '../lib/time';

function CoffeeCard({ c, recipes }: { c: Coffee; recipes: Recipe[] }) {
  const refs = recipes.filter((r) => r.isReference);
  const days = c.roastDate ? daysSince(c.roastDate) : null;
  return (
    <div className="card">
      <Link to={`/cafe/${c.id}`} style={{ color: 'inherit' }}>
        <h3>{c.name}</h3>
        <div className="small muted">
          {[c.roaster, c.origin, c.process].filter(Boolean).join(' · ')}
          {days !== null && ` · ${days} días desde tueste`}
        </div>
      </Link>
      <div className="chips">
        <span className="chip">{recipes.length} receta{recipes.length === 1 ? '' : 's'}</span>
        {refs.map((r) => (
          <Link key={r.id} to={`/receta/${r.id}/preparar`} className="chip ref">▶ {METHOD_LABELS[r.method]} ★</Link>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const coffees = useLiveQuery(() => db.coffees.orderBy('createdAt').reverse().toArray());
  const recipes = useLiveQuery(() => db.recipes.toArray());
  const [showOld, setShowOld] = useState(false);
  if (!coffees || !recipes) return null;

  const active = coffees.filter((c) => c.inStock);
  const old = coffees.filter((c) => !c.inStock);
  const of = (c: Coffee) => recipes.filter((r) => r.coffeeId === c.id);

  return (
    <>
      <h1>Mis cafés</h1>
      {coffees.length === 0 && (
        <div className="empty">
          <p>Aún no hay recetas guardadas.</p>
          <p className="small">Pide una receta al LLM con la instrucción de exportación (en Ajustes) y pégala en Importar.</p>
          <Link to="/importar" className="btn primary">Importar receta</Link>
        </div>
      )}
      {active.map((c) => <CoffeeCard key={c.id} c={c} recipes={of(c)} />)}
      {old.length > 0 && (
        <>
          <button type="button" className="block" onClick={() => setShowOld(!showOld)}>
            {showOld ? 'Ocultar' : 'Ver'} cafés sin existencias ({old.length})
          </button>
          {showOld && <div style={{ marginTop: 12 }}>{old.map((c) => <CoffeeCard key={c.id} c={c} recipes={of(c)} />)}</div>}
        </>
      )}
    </>
  );
}
