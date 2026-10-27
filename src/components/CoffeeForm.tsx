import { useState } from 'react';
import type { Coffee } from '../lib/types';
import { discardPhoto, PhotoField } from './Fields';

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

export type CoffeeFields = Omit<Coffee, 'id' | 'inStock' | 'createdAt' | 'stockGrams' | 'stockSetAt'>;

/** Formulario de café. Con `withGrams` pide además los gramos de la bolsa (alta de café). */
export function CoffeeForm({
  initial,
  withGrams,
  onSave,
  onCancel,
}: {
  initial: Partial<Coffee>;
  withGrams?: boolean;
  onSave: (fields: CoffeeFields, grams?: number) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map(([k]) => [k, (initial[k] as string | undefined) ?? ''])),
  );
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [tasting, setTasting] = useState((initial.tastingNotes ?? []).join(', '));
  const [photoId, setPhotoId] = useState(initial.photoId);
  const [grams, setGrams] = useState('');
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const gramsNum = Number(grams.replace(',', '.'));

  async function save() {
    const clean = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || undefined]));
    await onSave(
      {
        ...clean,
        name: draft.name.trim(),
        notes: notes.trim() || undefined,
        tastingNotes: tasting.split(',').map((s) => s.trim()).filter(Boolean),
        photoId,
      },
      withGrams && grams.trim() && gramsNum > 0 ? gramsNum : undefined,
    );
  }

  return (
    <div className="card">
      <PhotoField value={photoId} onChange={setPhotoId} />
      <div className="grid2">
        {FIELDS.map(([k, label]) => (
          <label key={k}>
            {label}
            <input type={k === 'roastDate' ? 'date' : 'text'} value={draft[k]} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>
      {withGrams && (
        <label>Gramos de la bolsa (opcional)<input inputMode="decimal" value={grams} placeholder="250" onChange={(e) => setGrams(e.target.value)} /></label>
      )}
      <label>Notas del tostador (separadas por comas)<input value={tasting} onChange={(e) => setTasting(e.target.value)} /></label>
      <label>Notas propias<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="row">
        <button type="button" className="primary" disabled={!draft.name.trim()} onClick={save}>Guardar</button>
        <button
          type="button"
          onClick={async () => {
            await discardPhoto(initial.photoId, photoId);
            onCancel();
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
