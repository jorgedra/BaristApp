import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAllTags } from '../lib/hooks';
import { SITE_KIND_LABELS, SITE_KINDS, type Site } from '../lib/types';
import { normalizeUrl, TagInput } from '../components/Fields';

const EMPTY: Site = { name: '', url: '', kind: 'roaster', tags: [], favorite: false, createdAt: '' };

export default function SiteForm() {
  const param = useParams().id;
  const isNew = param === 'nuevo';
  const id = Number(param) || -1;
  const navigate = useNavigate();
  const existing = useLiveQuery(async () => (isNew ? EMPTY : ((await db.sites.get(id)) ?? null)), [id, isNew]);
  const suggestions = useAllTags('sites');
  const [draft, setDraft] = useState<Site | null>(null);
  useEffect(() => {
    if (existing && !draft) setDraft(existing);
  }, [existing, draft]);

  if (existing === null) return <p className="empty">No encontrado.</p>;
  if (!draft) return null;
  const set = <K extends keyof Site>(k: K, v: Site[K]) => setDraft({ ...draft, [k]: v });

  async function save() {
    const site: Site = { ...draft!, name: draft!.name.trim(), url: normalizeUrl(draft!.url), notes: draft!.notes?.trim() || undefined };
    if (isNew) await db.sites.add({ ...site, createdAt: new Date().toISOString() });
    else await db.sites.put(site);
    navigate('/compras/tiendas', { replace: true });
  }

  return (
    <>
      <h1>{isNew ? 'Nueva tienda' : draft.name}</h1>
      <div className="card">
        <label>Nombre<input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre del tostador o tienda" /></label>
        <label>Web<input type="url" inputMode="url" value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></label>
        <label>
          Tipo
          <select value={draft.kind} onChange={(e) => set('kind', e.target.value as Site['kind'])}>
            {SITE_KINDS.map((k) => <option key={k} value={k}>{SITE_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <TagInput value={draft.tags} onChange={(v) => set('tags', v)} suggestions={suggestions} />
        <label>Notas<textarea style={{ minHeight: 70 }} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Envío, cafés que te gustaron, descuentos…" /></label>
        <label className="toggle">Favorito<input type="checkbox" checked={draft.favorite} onChange={(e) => set('favorite', e.target.checked)} /></label>
        <p className="small muted">Si el nombre coincide con el tostador de un café, su ficha mostrará «Comprar de nuevo».</p>
      </div>
      <div className="row">
        <button type="button" className="primary" disabled={!draft.name.trim() || !draft.url.trim()} onClick={save}>Guardar</button>
        <button type="button" onClick={() => navigate(-1)}>Cancelar</button>
        {!isNew && (
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (confirm(`¿Borrar «${draft.name}»?`)) {
                await db.transaction('rw', db.sites, db.wishlist, async () => {
                  await db.wishlist.filter((w) => w.siteId === id).modify((w) => void delete w.siteId);
                  await db.sites.delete(id);
                });
                navigate('/compras/tiendas', { replace: true });
              }
            }}
          >
            Borrar
          </button>
        )}
      </div>
    </>
  );
}
