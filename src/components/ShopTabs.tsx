import { NavLink } from 'react-router-dom';

export function ShopTabs() {
  return (
    <div className="tabs">
      <NavLink to="/compras/deseos">Lista de deseos</NavLink>
      <NavLink to="/compras/tiendas">Tiendas</NavLink>
    </div>
  );
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Búsqueda sin distinguir mayúsculas ni tildes. */
export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = norm(query.trim());
  return !q || fields.some((f) => f && norm(f).includes(q));
}
