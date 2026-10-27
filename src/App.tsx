import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import ImportPage from './pages/Import';
import CoffeePage from './pages/Coffee';
import NewCoffee from './pages/NewCoffee';
import RecipePage from './pages/Recipe';
import BrewMode from './pages/BrewMode';
import BrewLog from './pages/BrewLog';
import History from './pages/History';
import Settings from './pages/Settings';
import Wishlist from './pages/Wishlist';
import WishForm from './pages/WishForm';
import Sites from './pages/Sites';
import SiteForm from './pages/SiteForm';

export default function App() {
  return (
    <>
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/importar" element={<ImportPage />} />
          <Route path="/cafe/nuevo" element={<NewCoffee />} />
          <Route path="/cafe/:id" element={<CoffeePage />} />
          <Route path="/receta/:id" element={<RecipePage />} />
          <Route path="/receta/:id/preparar" element={<BrewMode />} />
          <Route path="/receta/:id/registrar" element={<BrewLog />} />
          <Route path="/preparacion/:brewId" element={<BrewLog />} />
          <Route path="/historial" element={<History />} />
          <Route path="/compras" element={<Navigate to="/compras/deseos" replace />} />
          <Route path="/compras/deseos" element={<Wishlist />} />
          <Route path="/compras/deseos/:id" element={<WishForm />} />
          <Route path="/compras/tiendas" element={<Sites />} />
          <Route path="/compras/tiendas/:id" element={<SiteForm />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<p className="empty">Página no encontrada.</p>} />
        </Routes>
      </main>
      <nav className="nav">
        <NavLink to="/" end><span>☕</span>Cafés</NavLink>
        <NavLink to="/historial"><span>📓</span>Historial</NavLink>
        <NavLink to="/compras"><span>🛒</span>Compras</NavLink>
        <NavLink to="/ajustes"><span>⚙︎</span>Ajustes</NavLink>
      </nav>
    </>
  );
}
