import { useId, useState } from 'react';
import type { Water } from '../lib/types';
import { formatNum } from '../lib/time';
import { useKnownWaters } from '../lib/hooks';

export function WaterInfo({ water }: { water: Water }) {
  const minerals = [
    water.tds !== undefined && `TDS ${formatNum(water.tds)} mg/L`,
    water.gh !== undefined && `GH ${formatNum(water.gh)}`,
    water.kh !== undefined && `KH ${formatNum(water.kh)}`,
  ].filter(Boolean);
  return (
    <div>
      <b>💧 {water.name}</b>
      {minerals.length > 0 && <span className="small muted"> · {minerals.join(' · ')}</span>}
      {water.notes && <div className="small">{water.notes}</div>}
    </div>
  );
}

/** Campo de texto con sugerencias de las aguas ya usadas. */
export function WaterNameInput({ value, onChange, label = 'Agua' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const known = useKnownWaters();
  const listId = useId();
  return (
    <label>
      {label}
      <input value={value} list={listId} placeholder="Fuente Dehesa, grifo filtrado…" onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>{known.map((w) => <option key={w} value={w} />)}</datalist>
    </label>
  );
}

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
};
const str = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','));

/** Agua de una receta: se muestra y se puede editar sin pasar por el JSON. */
export function WaterCard({ water, onSave }: { water?: Water; onSave: (w: Water | undefined) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState({ name: '', tds: '', gh: '', kh: '', notes: '' });
  const start = () => {
    setD({ name: water?.name ?? '', tds: str(water?.tds), gh: str(water?.gh), kh: str(water?.kh), notes: water?.notes ?? '' });
    setEditing(true);
  };
  const set = (k: keyof typeof d) => (v: string) => setD({ ...d, [k]: v });

  if (!editing)
    return (
      <div className="card">
        {water ? <WaterInfo water={water} /> : <p className="small muted">Sin agua indicada.</p>}
        <button type="button" style={{ marginTop: 8 }} onClick={start}>✎ {water ? 'Editar agua' : 'Indicar agua'}</button>
      </div>
    );

  return (
    <div className="card">
      <WaterNameInput value={d.name} onChange={set('name')} />
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <label>TDS (mg/L)<input inputMode="decimal" value={d.tds} onChange={(e) => set('tds')(e.target.value)} /></label>
        <label>GH (ppm)<input inputMode="decimal" value={d.gh} onChange={(e) => set('gh')(e.target.value)} /></label>
        <label>KH (ppm)<input inputMode="decimal" value={d.kh} onChange={(e) => set('kh')(e.target.value)} /></label>
      </div>
      <p className="small muted" style={{ marginTop: -4 }}>Valores minerales solo si los conoces (etiqueta o medición).</p>
      <label>Notas<input value={d.notes} placeholder="Mezcla, tratamiento…" onChange={(e) => set('notes')(e.target.value)} /></label>
      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={async () => {
            const name = d.name.trim();
            const w = { name, tds: num(d.tds), gh: num(d.gh), kh: num(d.kh), notes: d.notes.trim() || undefined };
            // sin claves vacías, para no guardar propiedades undefined
            await onSave(name ? (Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined)) as unknown as Water) : undefined);
            setEditing(false);
          }}
        >
          Guardar
        </button>
        <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
      </div>
    </div>
  );
}
