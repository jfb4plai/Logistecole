import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets, useCategories, useEmplacements, usePhotos } from '../data/hooks.js';
import { filtrerObjets } from '../domain/filtres.js';
import { ETATS } from '../domain/etats.js';
import { formaterCode } from '../domain/codes.js';
import { peutEcrire } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';

export default function Accueil() {
  const { orgId, orgNom, role } = useOrg();
  const objetsQ = useObjets(orgId);
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];
  const photos = usePhotos(objetsQ.data);
  const [f, setF] = useState({ q: '', categorieId: '', emplacementId: '', etat: '' });
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const tous = objetsQ.data ?? [];
  const visibles = filtrerObjets(tous, f);

  return (
    <>
      <div className="bandeau"><h1>{orgNom}</h1><p>{tous.filter((o) => o.etat !== 'sorti').length} objet(s) dans l'inventaire</p></div>
      <Link to="/scan" className="btn-scan">Scanner une étiquette</Link>

      <div className="filtres">
        <input className="plai-input" type="search" aria-label="Rechercher" placeholder="Rechercher : tablette, projecteur, ABCD-2345…" value={f.q} onChange={maj('q')} />
        <select className="plai-input" aria-label="Catégorie" value={f.categorieId} onChange={maj('categorieId')}>
          <option value="">Toutes les catégories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select className="plai-input" aria-label="Emplacement" value={f.emplacementId} onChange={maj('emplacementId')}>
          <option value="">Tous les emplacements</option>
          {emps.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select className="plai-input" aria-label="État" value={f.etat} onChange={maj('etat')}>
          <option value="">Tous les états (hors sortis)</option>
          {ETATS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      {objetsQ.isLoading && <p className="chargement">Chargement du matériel…</p>}
      {objetsQ.error && <p className="plai-error" role="alert">{messageErreur(objetsQ.error)}</p>}
      {!objetsQ.isLoading && !objetsQ.error && tous.length === 0 && (
        <div className="plai-empty">
          Aucun matériel pour l'instant.
          {peutEcrire(role) && <p><Link className="plai-btn btn-lien" to="/nouveau">Ajouter le premier objet</Link></p>}
        </div>
      )}
      {tous.length > 0 && visibles.length === 0 && <p className="plai-empty">Aucun objet ne correspond à ces filtres.</p>}

      <ul className="liste-objets">
        {visibles.map((o) => (
          <li key={o.id}>
            <Link to={`/o/${o.code}`} className="ligne-objet">
              {o.photo_path && photos[o.photo_path]
                ? <img className="vignette" src={photos[o.photo_path]} alt="" />
                : <span className="vignette vignette-vide" aria-hidden="true">Photo</span>}
              <span className="ligne-texte">
                <strong>{o.nom}</strong>
                <span className="meta">{o.logi_emplacements?.nom ?? 'Sans emplacement'} · <span className="code-court">{formaterCode(o.code)}</span></span>
              </span>
              <EtatBadge etat={o.etat} />
            </Link>
          </li>
        ))}
      </ul>

      <aside className="encart-avenir">
        <h2>Ce que Logistécole ne fait pas encore</h2>
        <p>
          Pour l'instant : inventaire, emplacements, historique, QR codes et étiquettes. Pas encore de prêts, de réservations,
          de notifications, ni de mode hors ligne : il faut du réseau pour enregistrer. Les prêts arrivent ensuite.
        </p>
      </aside>
    </>
  );
}
