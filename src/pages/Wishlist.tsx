import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { PRIORITY_LABELS, WISH_SECTION_LABELS, WISH_SECTIONS, WISH_STATUS_LABELS, type WishItem, type WishStatus } from '../lib/types';
import { LinkButton, PhotoThumb, Tags } from '../components/Fields';
import { matches, ShopTabs } from '../components/ShopTabs';

type StatusFilter = WishStatus | 'all';

export default function Wishlist() {
  const items = useLiveQuery(() => db.wishlist.toArray());
  const sites = useLiveQuery(() => db.sites.toArray());
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  if (!items || !sites) return null;

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const toggleTag = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const allTags = [...new Set(items.flatMap((i) => i.tags))].sort();
  const shown = items
    .filter((i) => (status === 'all' || i.status === status) && tags.every((t) => i.tags.includes(t)))
    .filter((i) => matches(query, i.title, i.notes, siteName.get(i.siteId), ...i.tags))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.createdAt.localeCompare(a.createdAt));

  const card = (i: WishItem) => (
    <div key={i.id} className="card">
      <Link to={`/compras/deseos/${i.id}`} className="item" style={{ color: 'inherit' }}>
        <PhotoThumb photoId={i.photoId} />
        <div className="grow">
          <div className="row between">
            <h3>{i.title}</h3>
            {i.price !== undefined && <b>{i.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</b>}
          </div>
          <div className="small muted">
            {[
              i.priority && `Prioridad ${PRIORITY_LABELS[i.priority].toLowerCase()}`,
              siteName.get(i.siteId),
              status === 'all' && WISH_STATUS_LABELS[i.status],
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </Link>
      <Tags tags={i.tags} active={tags} onClick={toggleTag} />
      {i.url && <div style={{ marginTop: 6 }}><LinkButton url={i.url} label="Ver en la web" /></div>}
    </div>
  );

  return (
    <>
      <ShopTabs />
      <div className="page-head">
        <h1>Lista de deseos</h1>
        <Link to="/compras/deseos/nuevo" className="btn primary">＋ Añadir</Link>
      </div>
      {items.length === 0 ? (
        <p className="empty">Apunta aquí cafés, accesorios o equipo que quieras comprar, con enlace, foto y etiquetas.</p>
      ) : (
        <>
          <input type="search" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 8 }} />
          <div className="tabs">
            {(['pending', 'bought', 'discarded', 'all'] as const).map((s) => (
              <button key={s} type="button" className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
                {s === 'all' ? 'Todos' : WISH_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <Tags tags={allTags} active={tags} onClick={toggleTag} />
          {shown.length === 0 && <p className="muted small">Nada coincide con el filtro.</p>}
          {WISH_SECTIONS.map((sec) => {
            const group = shown.filter((i) => i.section === sec);
            return group.length ? (
              <section key={sec}>
                <div className="section-title">{WISH_SECTION_LABELS[sec]} ({group.length})</div>
                {group.map(card)}
              </section>
            ) : null;
          })}
        </>
      )}
    </>
  );
}
