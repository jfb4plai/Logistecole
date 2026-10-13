import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import Connexion from './pages/Connexion.jsx';
import Accueil from './pages/Accueil.jsx';
import FicheObjet from './pages/FicheObjet.jsx';
import FormulaireObjet from './pages/FormulaireObjet.jsx';

// Pages lourdes (caméra, PDF, administration) chargées à la demande.
const Scan = lazy(() => import('./pages/Scan.jsx'));
const Etiquettes = lazy(() => import('./pages/Etiquettes.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

const enAttente = <p className="chargement">Chargement…</p>;

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Accueil />} />
        <Route path="/o/:code" element={<FicheObjet />} />
        <Route path="/o/:code/modifier" element={<FormulaireObjet mode="modifier" />} />
        <Route path="/nouveau" element={<FormulaireObjet mode="creer" />} />
        <Route path="/scan" element={<Suspense fallback={enAttente}><Scan /></Suspense>} />
        <Route path="/etiquettes" element={<Suspense fallback={enAttente}><Etiquettes /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={enAttente}><Admin /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
