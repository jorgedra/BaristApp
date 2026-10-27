import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAllTags } from '../lib/hooks';
import {
  PRIORITY_LABELS,
  WISH_SECTION_LABELS,
  WISH_SECTIONS,
  WISH_STATUS_LABELS,
  WISH_STATUSES,
  type Priority,
  type WishItem,
} from '../lib/types';
import { discardPhoto, LinkButton, normalizeUrl, PhotoField, replacePhoto, TagInput } from '../components/Fields';

const EMPTY: WishItem = { title: '', section: 'coffee', tags: [], status: 'pending', createdAt: '' };

export default function WishForm() {
  const param = useParams().id;
  const isNew = param === 'nuevo';
  const id = Number(param) || -1;
  const navigate = useNavigate();
  const saved = useLiveQuery(async () => (isNew ? EMPTY : ((await db.wishlist.get(id)) ?? null)), [id, isNew]);
  const sites = useLiveQuery(() => db.sites.orderBy('name').toArray());
  const suggestions = useAllTags('wishlist');
  const [draft, setDraft] = useState<WishItem | null>(null);
  const [price, setPrice] = useState('');
  useEffect(() => {
    if (saved && !draft) {
      setDraft(saved);
      setPrice(saved.price === undefined ? '' : String(saved.price).replace('.', ','));
    }
  }, [saved, draft]);

  if (saved === null) return <p className="empty">No encontrado.</p>;
  if (!draft || !sites) return null;
  const set = <K extends keyof WishItem>(k: K, v: WishItem[K]) => setDraft({ ...draft, [k]: v });

  async function persist(overrides: Partial<WishItem> = {}): Promise<number> {
    const p = Number(price.replace(',', '.'));
    const item: WishItem = {
      ...draft!,
      ...overrides,
      title: draft!.title.trim(),
      url: draft!.url ? normalizeUrl(draft!.url) : undefined,
      price: price.trim() && Number.isFinite(p) ? p : undefined,
      notes: draft!.notes?.trim() || undefined,
    };
    await replacePhoto(isNew ? undefined : saved!.photoId, item.photoId);
    if (isNew) return (await db.wishlist.add({ ...item, createdAt: new Date().toISOString() })) as number;
    await db.wishlist.put(item);
    return id;
  }

  /** Café comprado: guarda el elemento y abre el alta del café con los datos rellenados. */
  async function boughtCoffee() {
    const wishId = await persist();
    const site = sites!.find((s) => s.id === draft!.siteId);
    navigate('/cafe/nuevo', {
      replace: true,
      state: { wishId, prefill: { name: draft!.title.trim(), roaster: site?.kind === 'roaster' ? site.name : undefined, notes: draft!.notes } },
    });
  }

  const canSave = !!draft.title.trim();
  return (
    <>
      <h1>{isNew ? 'Nuevo deseo' : draft.title}</h1>
      <div className="card">
        <label>Nombre<input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="p. ej. Etiopía Guji natural, báscula con temporizador…" /></label>
        <label>
          Sección
          <select value={draft.section} onChange={(e) => set('section', e.target.value as WishItem['section'])}>
            {WISH_SECTIONS.map((s) => <option key={s} value={s}>{WISH_SECTION_LABELS[s]}</option>)}
          </select>
        </label>
        <TagInput value={draft.tags} onChange={(v) => set('tags', v)} suggestions={suggestions} />
        <label>Enlace<input type="url" inputMode="url" value={draft.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></label>
        {draft.url?.trim() && <div style={{ margin: '-4px 0 10px' }}><LinkButton url={draft.url} /></div>}
        <div className="grid2">
          <label>Precio aprox. (€)<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>
            Prioridad
            <select value={draft.priority ?? ''} onChange={(e) => set('priority', e.target.value ? (Number(e.target.value) as Priority) : undefined)}>
              <option value="">—</option>
              {([3, 2, 1] as const).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </label>
        </div>
        <label>
          Tienda
          <select value={draft.siteId ?? ''} onChange={(e) => set('siteId', e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">—</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Notas<textarea style={{ minHeight: 70 }} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
        <PhotoField value={draft.photoId} onChange={(v) => set('photoId', v)} />
        {!isNew && (
          <label>
            Estado
            <select value={draft.status} onChange={(e) => set('status', e.target.value as WishItem['status'])}>
              {WISH_STATUSES.map((s) => <option key={s} value={s}>{WISH_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
        )}
      </div>

      {draft.coffeeId !== undefined && <p className="small">Comprado → <Link to={`/cafe/${draft.coffeeId}`}>ver el café</Link></p>}

      <div className="row">
        <button type="button" className="primary" disabled={!canSave} onClick={async () => { await persist(); navigate('/compras/deseos', { replace: true }); }}>Guardar</button>
        {draft.status === 'pending' && draft.section === 'coffee' && (
          <button type="button" disabled={!canSave} onClick={boughtCoffee}>✓ Comprado → crear café</button>
        )}
        {draft.status === 'pending' && draft.section !== 'coffee' && (
          <button type="button" disabled={!canSave} onClick={async () => { await persist({ status: 'bought' }); navigate('/compras/deseos', { replace: true }); }}>✓ Comprado</button>
        )}
        <button
          type="button"
          onClick={async () => {
            await discardPhoto(isNew ? undefined : saved!.photoId, draft.photoId);
            navigate(-1);
          }}
        >
          Cancelar
        </button>
        {!isNew && (
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (confirm(`¿Borrar «${draft.title}»?`)) {
                await discardPhoto(saved!.photoId, draft.photoId);
                if (saved!.photoId !== undefined) await db.photos.delete(saved!.photoId);
                await db.wishlist.delete(id);
                navigate('/compras/deseos', { replace: true });
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
