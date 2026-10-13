import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import Connexion from './pages/Connexion.jsx';

const AVenir = ({ nom }) => <p className="plai-empty">{nom} : bientôt.</p>;

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<AVenir nom="Liste du matériel" />} />
        <Route path="/o/:code" element={<AVenir nom="Fiche" />} />
        <Route path="/o/:code/modifier" element={<AVenir nom="Modification" />} />
        <Route path="/nouveau" element={<AVenir nom="Ajout" />} />
        <Route path="/scan" element={<AVenir nom="Scan" />} />
        <Route path="/etiquettes" element={<AVenir nom="Étiquettes" />} />
        <Route path="/admin" element={<AVenir nom="Administration" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
