import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import { messageErreur } from '../lib/erreurs.js';
import Nav from './Nav.jsx';
import Footer from './Footer.jsx';
import AucuneOrganisation from '../pages/AucuneOrganisation.jsx';

export default function RequireAuth() {
  const { session, ready } = useAuth();
  const { loading, memberships, error } = useOrg();
  const loc = useLocation();

  if (!ready) return <p className="chargement">Chargement…</p>;
  if (!session) return <Navigate to="/connexion" replace state={{ from: loc.pathname + loc.search }} />;

  let contenu;
  if (loading) contenu = <p className="chargement">Chargement…</p>;
  else if (error) contenu = <p className="plai-error" role="alert">{messageErreur(error)}</p>;
  else if (memberships.length === 0) contenu = <AucuneOrganisation />;
  else contenu = <Outlet />;

  return (
    <>
      <Nav />
      <main className="plai-container page">{contenu}</main>
      <Footer />
    </>
  );
}
