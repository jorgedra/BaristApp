import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveImport, updateRecipe } from '../lib/db';
import { parseImport } from '../lib/importer';
import { METHOD_LABELS } from '../lib/types';
import { RecipeParams, StepList } from '../components/RecipeBits';
import { exampleJson } from '../lib/prompt';
import type { Recipe } from '../lib/types';

export default function ImportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const editId = params.get('editar') ? Number(params.get('editar')) : undefined;
  const [text, setText] = useState<string>((location.state as { json?: string } | null)?.json ?? '');
  const [coffeeChoice, setCoffeeChoice] = useState<string>('auto');
  const [saving, setSaving] = useState(false);

  const coffees = useLiveQuery(() => db.coffees.toArray(), []);
  const result = useMemo(() => (text.trim() ? parseImport(text) : null), [text]);
  const data = result?.ok ? result.data : undefined;

  const match = data && coffees?.find(
    (c) =>
      c.name.trim().toLowerCase() === data.coffee.name.trim().toLowerCase() &&
      (c.roaster ?? '').trim().toLowerCase() === (data.coffee.roaster ?? '').trim().toLowerCase(),
  );

  async function paste() {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      alert('El navegador no permite leer el portapapeles. Mantén pulsado el cuadro de texto y pega.');
    }
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      if (editId !== undefined) {
        await updateRecipe(db, editId, data.recipe);
        navigate(`/receta/${editId}`, { replace: true });
      } else {
        const chosen = coffeeChoice === 'auto' ? undefined : Number(coffeeChoice);
        const { recipeId } = await saveImport(db, data, chosen);
        navigate(`/receta/${recipeId}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  const preview: Recipe | undefined = data && {
    ...data.recipe,
    coffeeId: 0,
    targetTimeMin: data.recipe.targetTime?.min,
    targetTimeMax: data.recipe.targetTime?.max,
    isReference: false,
    createdAt: '',
  };

  return (
    <>
      <h1>{editId !== undefined ? 'Editar receta' : 'Importar receta'}</h1>
      {editId === undefined && (
        <p className="small muted">
          Pega la respuesta del LLM (entera o solo el bloque JSON). Necesita la instrucción de exportación que tienes en Ajustes.
        </p>
      )}
      <textarea className="code" value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "baristapp": 1, ... }' />
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" onClick={paste}>📋 Pegar</button>
        {text && <button type="button" onClick={() => setText('')}>Borrar</button>}
        {!text && editId === undefined && <button type="button" onClick={() => setText(exampleJson())}>Ver ejemplo</button>}
      </div>

      {result && !result.ok && (
        <div className="msg error">
          No se puede importar:
          <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {result?.ok && result.warnings.length > 0 && (
        <div className="msg warn">
          Revisa antes de guardar:
          <ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {data && preview && (
        <>
          <h2>Vista previa</h2>
          <div className="card">
            <h3>{data.coffee.name}</h3>
            <div className="small muted">{[data.coffee.roaster, data.coffee.origin, data.coffee.region, data.coffee.process, data.coffee.roastLevel].filter(Boolean).join(' · ')}</div>
            {editId === undefined && coffees && (
              <label style={{ marginTop: 10 }}>
                Guardar en
                <select value={coffeeChoice} onChange={(e) => setCoffeeChoice(e.target.value)}>
                  <option value="auto">{match ? `Café existente: ${match.name}` : 'Café nuevo'}</option>
                  {coffees.filter((c) => c.id !== match?.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.roaster ? ` (${c.roaster})` : ''}</option>
                  ))}
                </select>
              </label>
            )}
            {editId !== undefined && <p className="small muted">Al editar solo se actualiza la receta; los datos del café se editan en su ficha.</p>}
          </div>
          <div className="card">
            <h3>{data.recipe.name}</h3>
            <div className="chips"><span className="chip">{METHOD_LABELS[data.recipe.method]}</span>{data.recipe.filter && <span className="chip">{data.recipe.filter}</span>}</div>
            <RecipeParams r={preview} />
            <StepList steps={data.recipe.steps} />
          </div>
          <button type="button" className="primary block" disabled={saving} onClick={save}>
            {editId !== undefined ? 'Guardar cambios' : 'Guardar receta'}
          </button>
        </>
      )}
    </>
  );
}
