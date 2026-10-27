import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { METHOD_LABELS, type Brew, type Coffee, type Recipe } from '../lib/types';
import { daysSince } from '../lib/time';
import { remainingGrams, usualDose } from '../lib/stock';
import { PhotoThumb } from '../components/Fields';
import { StockLabel } from '../components/StockBits';

function CoffeeCard({ c, recipes, brews }: { c: Coffee; recipes: Recipe[]; brews: Brew[] }) {
  const refs = recipes.filter((r) => r.isReference);
  const days = c.roastDate ? daysSince(c.roastDate) : null;
  return (
    <div className="card">
      <Link to={`/cafe/${c.id}`} className="item" style={{ color: 'inherit' }}>
        <PhotoThumb photoId={c.photoId} />
        <div className="grow">
          <h3>{c.name}</h3>
          <div className="small muted">
            {[c.roaster, c.origin, c.process].filter(Boolean).join(' · ')}
            {days !== null && ` · ${days} días desde tueste`}
          </div>
          <div className="small"><StockLabel remaining={remainingGrams(c, brews)} dose={usualDose(recipes)} /></div>
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
  const brews = useLiveQuery(() => db.brews.toArray());
  const [showOld, setShowOld] = useState(false);
  if (!coffees || !recipes || !brews) return null;

  const active = coffees.filter((c) => c.inStock);
  const old = coffees.filter((c) => !c.inStock);
  const card = (c: Coffee) => (
    <CoffeeCard key={c.id} c={c} recipes={recipes.filter((r) => r.coffeeId === c.id)} brews={brews.filter((b) => b.coffeeId === c.id)} />
  );

  return (
    <>
      <div className="page-head">
        <h1>Mis cafés</h1>
        <div className="row">
          <Link to="/cafe/nuevo" className="btn">＋ Café</Link>
          <Link to="/importar" className="btn primary">＋ Importar</Link>
        </div>
      </div>
      {coffees.length === 0 && (
        <div className="empty">
          <p>Aún no hay recetas guardadas.</p>
          <p className="small">Pide una receta al LLM con la instrucción de exportación (en Ajustes) y pégala en Importar.</p>
          <Link to="/importar" className="btn primary">Importar receta</Link>
        </div>
      )}
      {active.map(card)}
      {old.length > 0 && (
        <>
          <button type="button" className="block" onClick={() => setShowOld(!showOld)}>
            {showOld ? 'Ocultar' : 'Ver'} cafés sin existencias ({old.length})
          </button>
          {showOld && <div style={{ marginTop: 12 }}>{old.map(card)}</div>}
        </>
      )}
    </>
  );
}
