import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import ImportPage from './pages/Import';
import CoffeePage from './pages/Coffee';
import RecipePage from './pages/Recipe';
import BrewMode from './pages/BrewMode';
import BrewLog from './pages/BrewLog';
import History from './pages/History';
import Settings from './pages/Settings';

export default function App() {
  return (
    <>
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/importar" element={<ImportPage />} />
          <Route path="/cafe/:id" element={<CoffeePage />} />
          <Route path="/receta/:id" element={<RecipePage />} />
          <Route path="/receta/:id/preparar" element={<BrewMode />} />
          <Route path="/receta/:id/registrar" element={<BrewLog />} />
          <Route path="/preparacion/:brewId" element={<BrewLog />} />
          <Route path="/historial" element={<History />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<p className="empty">Página no encontrada.</p>} />
        </Routes>
      </main>
      <nav className="nav">
        <NavLink to="/" end><span>☕</span>Cafés</NavLink>
        <NavLink to="/importar"><span>＋</span>Importar</NavLink>
        <NavLink to="/historial"><span>📓</span>Historial</NavLink>
        <NavLink to="/ajustes"><span>⚙︎</span>Ajustes</NavLink>
      </nav>
    </>
  );
}
