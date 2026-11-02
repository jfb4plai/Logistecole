import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets, useCategories, useEmplacements, usePhotos, usePrets } from '../data/hooks.js';
import { filtrerObjets } from '../domain/filtres.js';
import { ETATS } from '../domain/etats.js';
import { formaterCode } from '../domain/codes.js';
import { peutEcrire } from '../domain/permissions.js';
import { statutPret } from '../domain/echeance.js';
import { estSousSeuil } from '../domain/stock.js';
import { pretOuvertDe } from '../domain/kit.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';

const ton = { retard: 'alerte', bientot: 'attention', ok: 'ok' };

export default function Accueil() {
  const { orgId, orgNom, role } = useOrg();
  const objetsQ = useObjets(orgId);
  const pretsQ = usePrets(orgId, { ouverts: true });
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];
  const photos = usePhotos(objetsQ.data);
  const prets = pretsQ.data ?? [];
  const [f, setF] = useState({ q: '', categorieId: '', emplacementId: '', etat: '' });
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const tous = objetsQ.data ?? [];
  // Les éléments d'un kit se retrouvent dans la fiche du kit : la liste ne montre que les objets de premier niveau,
  // sauf quand on cherche ou qu'on filtre.
  const filtre = f.q || f.categorieId || f.emplacementId || f.etat;
  const visibles = filtrerObjets(tous, f).filter((o) => filtre || !o.parent_id);
  const enRetard = prets.filter((p) => !p.logi_objets?.parent_id && statutPret(p).niveau === 'retard').length;
  const sousSeuil = tous.filter(estSousSeuil).length;

  return (
    <>
      <div className="bandeau"><h1>{orgNom}</h1><p>{tous.filter((o) => o.etat !== 'sorti' && !o.parent_id).length} objet(s) dans l'inventaire</p></div>
      {peutEcrire(role) && (enRetard > 0 || sousSeuil > 0) && (
        <p className="plai-error" role="status">
          {enRetard > 0 && <>{enRetard} prêt{enRetard > 1 ? 's' : ''} en retard. </>}
          {sousSeuil > 0 && <>{sousSeuil} consommable{sousSeuil > 1 ? 's' : ''} à racheter. </>}
          <Link to="/suivi">Voir le suivi</Link>
        </p>
      )}
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
        {visibles.map((o) => {
          const pret = pretOuvertDe(prets, o.id);
          const s = pret ? statutPret(pret) : null;
          return (
            <li key={o.id}>
              <Link to={`/o/${o.code}`} className="ligne-objet">
                {o.photo_path && photos[o.photo_path]
                  ? <img className="vignette" src={photos[o.photo_path]} alt="" />
                  : <span className="vignette vignette-vide" aria-hidden="true">Photo</span>}
                <span className="ligne-texte">
                  <strong>{o.nom}</strong>
                  <span className="meta">
                    {o.consommable ? `${o.quantite} en stock` : (o.logi_emplacements?.nom ?? 'Sans emplacement')} · <span className="code-court">{formaterCode(o.code)}</span>
                    {pret && <> · Prêté à {pret.logi_emprunteurs?.libelle}</>}
                  </span>
                </span>
                {pret ? <span className={`badge-etat badge-${ton[s.niveau]}`}>{s.niveau === 'retard' ? 'En retard' : 'Prêté'}</span>
                  : estSousSeuil(o) ? <span className="badge-etat badge-alerte">À racheter</span>
                  : <EtatBadge etat={o.etat} />}
              </Link>
            </li>
          );
        })}
      </ul>

      <aside className="encart-avenir">
        <h2>Ce que Logistécole ne fait pas</h2>
        <p>
          Pas de mode hors ligne : il faut du réseau pour ouvrir une fiche et enregistrer. Pas de rappel automatique par e-mail : les retards
          s'affichent dans « Suivi » et « Mes emprunts ». Pas de comptabilité : les informations d'achat servent de mémoire.
        </p>
      </aside>
    </>
  );
}
