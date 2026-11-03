import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets, useCategories, useEmplacements, usePhotos, usePrets, useCriteres, useCatalogueAmenagements } from '../data/hooks.js';
import { filtrerObjets } from '../domain/filtres.js';
import { organiserCatalogue, selectionVide } from '../domain/amenagements.js';
import { autresVides } from '../domain/criteres.js';
import { ETATS } from '../domain/etats.js';
import { formaterCode } from '../domain/codes.js';
import { peutEcrire } from '../domain/permissions.js';
import { statutPret } from '../domain/echeance.js';
import { estSousSeuil } from '../domain/stock.js';
import { pretOuvertDe, pretsEnCours } from '../domain/kit.js';
import { cheminsEmplacements, cheminDe } from '../domain/emplacements.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';
import PourQui from '../components/PourQui.jsx';

const ton = { retard: 'alerte', bientot: 'attention', ok: 'ok' };

export default function Accueil() {
  const { orgId, orgNom, role } = useOrg();
  const objetsQ = useObjets(orgId);
  const pretsQ = usePrets(orgId, { ouverts: true });
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];
  const photos = usePhotos(objetsQ.data);
  const prets = pretsQ.data ?? [];
  const [f, setF] = useState({ q: '', categorieId: '', emplacementId: '', etat: '', type: '' });
  const [pq, setPq] = useState({ critereIds: [], selection: selectionVide(), autres: autresVides() });
  const critQ = useCriteres();
  const catQ = useCatalogueAmenagements();
  const catalogue = useMemo(() => organiserCatalogue(catQ.data ?? {}), [catQ.data]);
  const contexte = useMemo(() => ({
    criteres: critQ.data ?? [],
    chapitreDeAmenagement: new Map((catQ.data?.amenagements ?? []).map((a) => [a.id, a.chapitre_id])),
  }), [critQ.data, catQ.data]);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const tous = objetsQ.data ?? [];
  // Les éléments d'un kit se retrouvent dans la fiche du kit : la liste ne montre que les objets de premier niveau,
  // sauf quand on cherche ou qu'on filtre.
  const criteresChoisis = pq.critereIds.length + pq.selection.chapitres.length + pq.selection.amenagements.length;
  const nbFiltres = [f.categorieId, f.emplacementId, f.etat].filter(Boolean).length + criteresChoisis;
  const filtre = f.q || f.type || nbFiltres > 0;
  const filtres = { ...f, critereIds: pq.critereIds, chapitreIds: pq.selection.chapitres, amenagementIds: pq.selection.amenagements };
  const visibles = filtrerObjets(tous, filtres, contexte).filter((o) => filtre || !o.parent_id);
  const enRetard = pretsEnCours(prets).filter((p) => statutPret(p).niveau === 'retard').length;
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
        <input className="plai-input" type="search" aria-label="Rechercher" aria-describedby="recherche-aide"
          placeholder="Rechercher : tablette, auteur, ISBN, ABCD-2345…" value={f.q} onChange={maj('q')} />
        <select className="plai-input" aria-label="Type" value={f.type} onChange={maj('type')}>
          <option value="">Physique et numérique</option>
          <option value="physique">Physique</option>
          <option value="numerique">Numérique</option>
        </select>
      </div>
      <p id="recherche-aide" className="champ-aide">Cherche dans le nom, l'auteur, l'éditeur, l'ISBN, la description, les notes et le code.</p>

      <details className="plai-card details-form">
        <summary>Filtres{nbFiltres > 0 ? ` (${nbFiltres})` : ''}</summary>
        <div className="filtres">
          <select className="plai-input" aria-label="Catégorie" value={f.categorieId} onChange={maj('categorieId')}>
            <option value="">Toutes les catégories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select className="plai-input" aria-label="Emplacement" value={f.emplacementId} onChange={maj('emplacementId')}>
            <option value="">Tous les emplacements</option>
            {cheminsEmplacements(emps).map((e) => <option key={e.id} value={e.id}>{e.chemin}</option>)}
          </select>
          <select className="plai-input" aria-label="État" value={f.etat} onChange={maj('etat')}>
            <option value="">Tous les états (hors sortis)</option>
            {ETATS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
        <PourQui criteres={critQ.data ?? []} catalogue={catalogue} valeur={pq} onChange={setPq} sansAutre
          chargement={critQ.isLoading || catQ.isLoading} erreur={critQ.error || catQ.error}
          texteErreur="Les filtres par trouble, difficulté et aménagement ne sont pas disponibles pour le moment. La recherche et la liste fonctionnent." />
        {criteresChoisis > 0 && (
          <p><button type="button" className="plai-btn-ghost" onClick={() => setPq({ critereIds: [], selection: selectionVide(), autres: autresVides() })}>Effacer les critères</button></p>
        )}
      </details>

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
                    {o.consommable ? `${o.quantite} en stock` : o.type_ressource === 'numerique' ? 'Numérique' : (cheminDe(emps, o.emplacement_id) ?? o.logi_emplacements?.nom ?? 'Sans emplacement')} · <span className="code-court">{formaterCode(o.code)}</span>
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
