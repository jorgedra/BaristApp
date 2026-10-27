import { useState } from 'react';
import { db } from '../lib/db';
import { addBag, adjustStock, clearStock, cupsLeft } from '../lib/stock';
import { formatDate, formatNum } from '../lib/time';
import type { Coffee } from '../lib/types';

/** «143 g · ~10 tazas», en ámbar si no llega para otra preparación y en rojo si está agotado. */
export function StockLabel({ remaining, dose }: { remaining?: number; dose?: number }) {
  if (remaining === undefined) return null;
  const cups = cupsLeft(remaining, dose);
  const cls = remaining <= 0 ? 'out' : dose && remaining < dose ? 'low' : '';
  return (
    <span className={`stock ${cls}`}>
      {remaining <= 0 ? 'Agotado' : `≈ ${formatNum(remaining)} g`}
      {remaining > 0 && cups !== undefined && ` · ~${cups} taza${cups === 1 ? '' : 's'}`}
    </span>
  );
}

const parse = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function StockCard({ coffee, remaining, dose }: { coffee: Coffee; remaining?: number; dose?: number }) {
  const [mode, setMode] = useState<'adjust' | 'bag' | null>(null);
  const [grams, setGrams] = useState('');
  const [roastDate, setRoastDate] = useState('');
  const id = coffee.id!;
  const value = parse(grams);

  async function submit() {
    if (value === undefined) return;
    if (mode === 'adjust') await adjustStock(db, id, value);
    else await addBag(db, id, value, roastDate || undefined);
    setMode(null);
    setGrams('');
    setRoastDate('');
  }

  return (
    <div className="card stack">
      {remaining === undefined ? (
        <p className="small muted">Sin registrar. Indica cuánto café tienes y se irá descontando con cada preparación.</p>
      ) : (
        <>
          <div style={{ fontSize: '1.2rem' }}><StockLabel remaining={remaining} dose={dose} /></div>
          <p className="small muted">
            Desde {formatDate(coffee.stockSetAt!)} ({formatNum(coffee.stockGrams!)} g), descontando las preparaciones registradas.
            {dose !== undefined && ` Dosis habitual: ${formatNum(dose)} g.`}
          </p>
        </>
      )}

      {mode ? (
        <>
          <label>
            {mode === 'adjust' ? 'Gramos que quedan (pesa la bolsa sin el envase)' : 'Gramos de la bolsa nueva'}
            <input inputMode="decimal" autoFocus value={grams} onChange={(e) => setGrams(e.target.value)} />
          </label>
          {mode === 'bag' && (
            <label>Fecha de tueste de la bolsa nueva (opcional)<input type="date" value={roastDate} onChange={(e) => setRoastDate(e.target.value)} /></label>
          )}
          <div className="row">
            <button type="button" className="primary" disabled={value === undefined} onClick={submit}>Guardar</button>
            <button type="button" onClick={() => setMode(null)}>Cancelar</button>
          </div>
        </>
      ) : (
        <div className="row">
          <button type="button" onClick={() => setMode('adjust')}>⚖︎ {remaining === undefined ? 'Registrar existencias' : 'Ajustar'}</button>
          <button type="button" onClick={() => setMode('bag')}>＋ Añadir bolsa</button>
          {remaining !== undefined && (
            <button type="button" onClick={() => confirm('¿Dejar de seguir las existencias de este café?') && clearStock(db, id)}>Dejar de seguir</button>
          )}
        </div>
      )}
    </div>
  );
}
