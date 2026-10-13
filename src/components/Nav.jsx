import { NavLink, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useOrg } from '../lib/org.jsx';
import { estAdmin, peutEcrire } from '../domain/permissions.js';

export default function Nav() {
  const { memberships, orgId, orgNom, role, choisir } = useOrg();
  return (
    <header className="plai-nav nav-logi">
      <Link to="/" className="plai-nav-logo">
        <img src="/plai-logo.jpg" alt="PLAI" className="logo-nav" />
        <span>Logistécole</span>
      </Link>
      <div className="plai-nav-actions">
        {memberships.length > 1 ? (
          <select aria-label="Organisation" className="plai-input select-org" value={orgId ?? ''} onChange={(e) => choisir(e.target.value)}>
            {memberships.map((m) => <option key={m.orgId} value={m.orgId}>{m.organisation.nom}</option>)}
          </select>
        ) : (
          <span className="nom-org">{orgNom}</span>
        )}
        <button type="button" className="plai-nav-link" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </div>
      <nav className="onglets" aria-label="Navigation principale">
        <NavLink to="/" end>Matériel</NavLink>
        <NavLink to="/scan">Scanner</NavLink>
        <NavLink to="/etiquettes">Étiquettes</NavLink>
        {peutEcrire(role) && <NavLink to="/nouveau">Ajouter</NavLink>}
        {estAdmin(role) && <NavLink to="/admin">Administration</NavLink>}
      </nav>
    </header>
  );
}
