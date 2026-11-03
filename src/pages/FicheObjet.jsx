import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import {
  getObjetParCode, modifierObjet, supprimerObjet, listerHistorique, ajouterEntreeHistorique, urlsPhotos,
} from '../data/objets.js';
import { useEmplacements, useObjets, usePrets, useReservations, useEmprunteurs, useCriteres, useCatalogueAmenagements } from '../data/hooks.js';
import { organiserCatalogue } from '../domain/amenagements.js';
import { libelleEvenement } from '../domain/historique.js';
import { normaliserCode, formaterCode } from '../domain/codes.js';
import { ETATS } from '../domain/etats.js';
import { actionsFiche } from '../domain/actions.js';
import { pretOuvertDe } from '../domain/kit.js';
import { cheminsEmplacements, cheminDe } from '../domain/emplacements.js';
import { estAdmin, peutEcrire } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';
import ChampGuide from '../components/ChampGuide.jsx';
import BlocPret from '../components/fiche/BlocPret.jsx';
import BlocReservations from '../components/fiche/BlocReservations.jsx';
import BlocPanne from '../components/fiche/BlocPanne.jsx';
import BlocStock from '../components/fiche/BlocStock.jsx';
import BlocAchat from '../components/fiche/BlocAchat.jsx';
import BlocKit from '../components/fiche/BlocKit.jsx';
import BlocPourQui from '../components/fiche/BlocPourQui.jsx';
import BlocNfc from '../components/fiche/BlocNfc.jsx';

export default function FicheObjet() {
  const { code: codeUrl } = useParams();
  const code = normaliserCode(codeUrl);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useAuth();
  const { memberships, orgId, choisir } = useOrg();
  const userId = session?.user?.id;
  const avertissement = useLocation().state?.avertissement;

  const objetQ = useQuery({ queryKey: ['objet', code], enabled: !!code, queryFn: () => getObjetParCode(code) });
  const objet = objetQ.data;
  const objOrg = objet?.org_id;
  const role = memberships.find((m) => m.orgId === objOrg)?.role ?? null;

  // Un QR d'une autre de mes organisations : on bascule dessus.
  useEffect(() => {
    if (objet && objet.org_id !== orgId) choisir(objet.org_id);
  }, [objet, orgId, choisir]);

  const histQ = useQuery({ queryKey: ['historique', objet?.id], enabled: !!objet, queryFn: () => listerHistorique(objet.id) });
  const emps = useEmplacements(objOrg).data ?? [];
  const objets = useObjets(objOrg).data ?? [];
  const prets = usePrets(objOrg, { ouverts: true }).data ?? [];
  const reservations = useReservations(objOrg).data ?? [];
  const emprunteurs = useEmprunteurs(objOrg, peutEcrire(role)).data ?? [];
  const critQ = useCriteres();
  const catQ = useCatalogueAmenagements();
  const catalogue = useMemo(() => organiserCatalogue(catQ.data ?? {}, { dejaChoisis: objet?.amenagement_ids ?? [] }), [catQ.data, objet]);
  const photoQ = useQuery({
    queryKey: ['photo', objet?.photo_path], enabled: !!objet?.photo_path,
    queryFn: async () => (await urlsPhotos([objet.photo_path]))[objet.photo_path],
  });

  const [emp, setEmp] = useState('');
  const [etat, setEtat] = useState('');
  const [correction, setCorrection] = useState('');
  const [erreur, setErreur] = useState('');

  const rafraichir = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['objet'] }),
      qc.invalidateQueries({ queryKey: ['historique', objet?.id] }),
      qc.invalidateQueries({ queryKey: ['objets', objOrg] }),
      qc.invalidateQueries({ queryKey: ['prets', objOrg] }),
      qc.invalidateQueries({ queryKey: ['reservations', objOrg] }),
      qc.invalidateQueries({ queryKey: ['emprunteurs', objOrg] }),
    ]);
  };
  const run = (fn) => async () => {
    setErreur('');
    try { await fn(); await rafraichir(); } catch (e) { setErreur(messageErreur(e)); }
  };

  if (!code) {
    return <div className="plai-card"><h1>Code invalide</h1><p>Ce code n'est pas une étiquette Logistécole.</p><Link to="/scan" className="plai-btn btn-lien">Scanner une autre étiquette</Link></div>;
  }
  if (objetQ.isLoading) return <p className="chargement">Chargement…</p>;
  if (objetQ.error) return <p className="plai-error" role="alert">{messageErreur(objetQ.error)}</p>;
  if (!objet) {
    return (
      <div className="plai-card">
        <h1>Objet introuvable</h1>
        <p>Aucun objet ne porte le code <span className="code-court">{formaterCode(code)}</span> dans vos organisations. Il appartient peut-être à une autre école ou à un autre Pôle, ou il a été supprimé.</p>
        <Link to="/scan" className="plai-btn btn-lien">Scanner une autre étiquette</Link>
      </div>
    );
  }

  const pret = pretOuvertDe(prets, objet.id);
  const estMonPret = !!pret && pret.logi_emprunteurs?.compte_id === userId;
  const actions = actionsFiche({ objet, role, prets, estMonPret });
  const ecrit = peutEcrire(role);
  const numerique = objet.type_ressource === 'numerique';
  const typeLibelle = { numerique: 'Numérique', les_deux: 'Physique et numérique' }[objet.type_ressource];

  return (
    <>
      <p><Link to="/">← Retour au matériel</Link></p>
      {avertissement && <p className="plai-error" role="alert">{avertissement}</p>}
      <h1>{objet.nom}</h1>
      <p><EtatBadge etat={objet.etat} /> <span className="code-court">{formaterCode(objet.code)}</span></p>
      {photoQ.data && <img className="fiche-photo" src={photoQ.data} alt={`Photo : ${objet.nom}`} />}

      <section className="plai-card">
        <p><strong>Catégorie :</strong> {objet.logi_categories?.nom ?? 'Aucune'}</p>
        <p><strong>Emplacement :</strong> {cheminDe(emps, objet.emplacement_id) ?? objet.logi_emplacements?.nom ?? 'Aucun'}</p>
        {typeLibelle && <p><strong>Type :</strong> <span>{typeLibelle}</span></p>}
        {objet.auteur && <p><strong>Auteur :</strong> <span>{objet.auteur}</span></p>}
        {objet.editeur && <p><strong>Éditeur :</strong> <span>{objet.editeur}</span></p>}
        {objet.isbn && <p><strong>ISBN :</strong> <span className="code-court">{objet.isbn}</span></p>}
        {objet.description && <p>{objet.description}</p>}
        {objet.notes && <p><strong>Notes :</strong> {objet.notes}</p>}
      </section>

      <BlocPourQui objet={objet} criteres={critQ.data ?? []} catalogue={catalogue} />

      {erreur && <p className="plai-error" role="alert">{erreur}</p>}

      {!objet.consommable && !numerique && (
        <BlocPret objet={objet} objets={objets} prets={prets} actions={actions} emprunteurs={emprunteurs} orgId={objOrg} surChangement={rafraichir} />
      )}
      {!numerique && <BlocStock objet={objet} actions={actions} surChangement={rafraichir} />}
      {!numerique && <BlocReservations objet={objet} reservations={reservations} actions={actions} role={role} userId={userId} emprunteurs={emprunteurs} surChangement={rafraichir} />}
      {!numerique && <BlocKit objet={objet} objets={objets} />}
      <BlocAchat objet={objet} />
      <BlocPanne objet={objet} actions={actions} surChangement={rafraichir} />

      {ecrit && (
        <section>
          <h2>Gestion</h2>
          <div className="actions">
            <Link className="plai-btn btn-lien" to={`/o/${objet.code}/modifier`}>Modifier la fiche</Link>
            {!numerique && <Link className="plai-btn-ghost btn-lien" to={`/etiquettes?codes=${objet.code}`}>Imprimer l'étiquette</Link>}
          </div>

          <ChampGuide id="deplacer" label="Déplacer vers" aide="Enregistre le nouvel emplacement et le garde dans l'historique. Les emplacements se créent dans l'administration.">
            <div className="bloc-action">
              <select id="deplacer" aria-describedby="deplacer-aide" className="plai-input" value={emp} onChange={(e) => setEmp(e.target.value)}>
                <option value="">Choisir un emplacement…</option>
                {cheminsEmplacements(emps).map((e) => <option key={e.id} value={e.id}>{e.chemin}</option>)}
              </select>
              <button className="plai-btn" disabled={!emp || emp === objet.emplacement_id} onClick={run(() => modifierObjet(objet.id, { emplacement_id: emp }))}>Déplacer</button>
            </div>
          </ChampGuide>

          <ChampGuide id="changer-etat" label="Changer l'état" aide="« Sorti de l'inventaire » garde l'objet et son historique (don, rebut) : il disparaît seulement de la liste par défaut.">
            <div className="bloc-action">
              <select id="changer-etat" aria-describedby="changer-etat-aide" className="plai-input" value={etat} onChange={(e) => setEtat(e.target.value)}>
                <option value="">Choisir un état…</option>
                {ETATS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <button className="plai-btn" disabled={!etat || etat === objet.etat} onClick={run(() => modifierObjet(objet.id, { etat }))}>Enregistrer l'état</button>
            </div>
          </ChampGuide>

          <ChampGuide id="correction" label="Ajouter une correction ou une note" aide="L'historique ne se modifie jamais : pour rectifier une erreur ou ajouter un constat, écrivez-le ici. Il s'ajoute à la suite, signé de votre adresse.">
            <div className="bloc-action">
              <input id="correction" aria-describedby="correction-aide" className="plai-input" maxLength={1000}
                placeholder="Ex. : le déplacement du 12 sept. concernait la salle 21, pas la 12"
                value={correction} onChange={(e) => setCorrection(e.target.value)} />
              <button className="plai-btn" disabled={!correction.trim()}
                onClick={run(async () => { await ajouterEntreeHistorique({ objetId: objet.id, orgId: objet.org_id, type: 'correction', commentaire: correction.trim() }); setCorrection(''); })}>
                Ajouter à l'historique
              </button>
            </div>
          </ChampGuide>
          <BlocNfc objet={objet} />
        </section>
      )}

      <section>
        <h2>Historique</h2>
        {histQ.error && <p className="plai-error" role="alert">{messageErreur(histQ.error)}</p>}
        <ul className="historique">
          {(histQ.data ?? []).map((ev) => (
            <li key={ev.id}>
              {libelleEvenement(ev)}
              <time dateTime={ev.quand}>{new Date(ev.quand).toLocaleString('fr-BE', { dateStyle: 'long', timeStyle: 'short' })}</time>
              {ev.auteur_email && <span className="auteur">par {ev.auteur_email}</span>}
            </li>
          ))}
        </ul>
      </section>

      {estAdmin(role) && (
        <section>
          <h2>Zone sensible</h2>
          <p className="champ-aide">Supprimer définitivement efface l'objet ET son historique. Pour un don ou un rebut, utilisez plutôt l'état « Sorti de l'inventaire ».</p>
          <button className="btn-danger" onClick={run(async () => {
            if (!window.confirm(`Supprimer définitivement « ${objet.nom} » et tout son historique ?`)) return;
            await supprimerObjet(objet.id);
            qc.invalidateQueries({ queryKey: ['objets', objet.org_id] });
            navigate('/');
          })}>Supprimer définitivement</button>
        </section>
      )}
    </>
  );
}
