import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteRecipe, setReference } from '../lib/db';
import { METHOD_LABELS } from '../lib/types';
import { payloadToJson, recipeText, toImportPayload } from '../lib/summary';
import { RecipeParams, StepList } from '../components/RecipeBits';
import { ShareText } from '../components/ShareText';
import { BrewRow } from './History';

export default function RecipePage() {
  const id = Number(useParams().id) || -1; // -1: clave válida que nunca existe (NaN rompe IndexedDB)
  const navigate = useNavigate();
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id]);
  const coffee = useLiveQuery(async () => (recipe ? ((await db.coffees.get(recipe.coffeeId)) ?? null) : undefined), [recipe]);
  const brews = useLiveQuery(() => db.brews.where('recipeId').equals(id).reverse().sortBy('date'), [id]);

  if (recipe === null) return <p className="empty">Receta no encontrada.</p>;
  if (!recipe || !coffee || !brews) return null;
  const json = () => payloadToJson(toImportPayload(coffee, recipe));

  return (
    <>
      <Link to={`/cafe/${coffee.id}`} className="small">← {coffee.name}</Link>
      <h1>{recipe.name}</h1>
      <div className="chips">
        <span className="chip">{METHOD_LABELS[recipe.method]}</span>
        {recipe.filter && <span className="chip">{recipe.filter}</span>}
        {recipe.isReference && <span className="chip ref">★ referencia</span>}
      </div>
      <RecipeParams r={recipe} />
      {recipe.accessories && <p className="small muted">Accesorios: {recipe.accessories}</p>}

      <Link to={`/receta/${id}/preparar`} className="btn primary block" style={{ margin: '8px 0 4px' }}>▶ Preparar</Link>
      <Link to={`/receta/${id}/registrar`} className="btn block" style={{ marginBottom: 8 }}>Registrar sin cronómetro</Link>

      <h2>Pasos</h2>
      <div className="card"><StepList steps={recipe.steps} /></div>

      {recipe.rationale && (<><h2>Motivo</h2><p className="small">{recipe.rationale}</p></>)}

      {recipe.adjustments.length > 0 && (
        <>
          <h2>Ajustes según el resultado</h2>
          <div className="card">
            {recipe.adjustments.map((a, i) => (
              <p key={i} className="small"><b>{a.when}:</b> {a.then}</p>
            ))}
          </div>
        </>
      )}
      {recipe.notes && (<><h2>Notas</h2><p className="small">{recipe.notes}</p></>)}

      <h2>Preparaciones con esta receta</h2>
      {brews.length === 0 && <p className="muted small">Ninguna todavía.</p>}
      {brews.map((b) => <BrewRow key={b.id} b={b} />)}

      <h2>Acciones</h2>
      <div className="row">
        <button type="button" onClick={() => setReference(db, id, !recipe.isReference)}>
          {recipe.isReference ? '☆ Quitar referencia' : '★ Marcar como referencia'}
        </button>
        <ShareText label="Copiar texto" title={recipe.name} text={() => recipeText(recipe)} />
        <ShareText label="Copiar JSON" title={recipe.name} text={json} />
        <button type="button" onClick={() => navigate(`/importar?editar=${id}`, { state: { json: json() } })}>✎ Editar JSON</button>
        <button type="button" onClick={() => navigate('/importar', { state: { json: json() } })}>⧉ Duplicar como variante</button>
        <button
          type="button"
          className="danger"
          onClick={async () => {
            if (confirm(`¿Borrar la receta y sus ${brews.length} preparaciones?`)) {
              await deleteRecipe(db, id);
              navigate(`/cafe/${coffee.id}`, { replace: true });
            }
          }}
        >
          Borrar
        </button>
      </div>
    </>
  );
}
