import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { SITE_KIND_LABELS, SITE_KINDS, type SiteKind } from '../lib/types';
import { hostOf, LinkButton, Tags } from '../components/Fields';
import { matches, ShopTabs } from '../components/ShopTabs';

export default function Sites() {
  const sites = useLiveQuery(() => db.sites.toArray());
  const [kind, setKind] = useState<SiteKind | 'all'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  if (!sites) return null;

  const toggleTag = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const allTags = [...new Set(sites.flatMap((s) => s.tags))].sort();
  const shown = sites
    .filter((s) => (kind === 'all' || s.kind === kind) && tags.every((t) => s.tags.includes(t)) && matches(query, s.name, s.url, s.notes, ...s.tags))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'es'));

  return (
    <>
      <ShopTabs />
      <div className="page-head">
        <h1>Tiendas y tostadores</h1>
        <Link to="/compras/tiendas/nuevo" className="btn primary">＋ Añadir</Link>
      </div>
      {sites.length === 0 ? (
        <p className="empty">Guarda aquí tus tostadores y tiendas favoritos para abrirlos rápido cuando necesites café.</p>
      ) : (
        <>
          <input type="search" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 8 }} />
          <div className="tabs">
            <button type="button" className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')}>Todos</button>
            {SITE_KINDS.map((k) => (
              <button key={k} type="button" className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{SITE_KIND_LABELS[k]}</button>
            ))}
          </div>
          <Tags tags={allTags} active={tags} onClick={toggleTag} />
          {shown.length === 0 && <p className="muted small">Nada coincide con el filtro.</p>}
          {shown.map((s) => (
            <div key={s.id} className="card">
              <div className="row between" style={{ flexWrap: 'nowrap' }}>
                <Link to={`/compras/tiendas/${s.id}`} style={{ color: 'inherit', minWidth: 0 }}>
                  <h3>{s.favorite && '★ '}{s.name}</h3>
                  <div className="small muted">{SITE_KIND_LABELS[s.kind]} · {hostOf(s.url)}</div>
                </Link>
                <LinkButton url={s.url} />
              </div>
              {s.notes && <p className="small" style={{ marginTop: 6 }}>{s.notes}</p>}
              <Tags tags={s.tags} active={tags} onClick={toggleTag} />
            </div>
          ))}
        </>
      )}
    </>
  );
}
