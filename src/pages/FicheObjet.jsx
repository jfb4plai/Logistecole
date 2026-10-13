import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import {
  getObjetParCode, modifierObjet, supprimerObjet, listerHistorique, ajouterEntreeHistorique, urlsPhotos,
} from '../data/objets.js';
import { useEmplacements } from '../data/hooks.js';
import { libelleEvenement } from '../domain/historique.js';
import { normaliserCode, formaterCode } from '../domain/codes.js';
import { ETATS } from '../domain/etats.js';
import { peutEcrire, estAdmin } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';
import ChampGuide from '../components/ChampGuide.jsx';

export default function FicheObjet() {
  const { code: codeUrl } = useParams();
  const code = normaliserCode(codeUrl);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { memberships, orgId, choisir } = useOrg();

  const objetQ = useQuery({ queryKey: ['objet', code], enabled: !!code, queryFn: () => getObjetParCode(code) });
  const objet = objetQ.data;
  const role = memberships.find((m) => m.orgId === objet?.org_id)?.role ?? null;

  // Un QR d'une autre de mes organisations : on bascule dessus.
  useEffect(() => {
    if (objet && objet.org_id !== orgId) choisir(objet.org_id);
  }, [objet, orgId, choisir]);

  const histQ = useQuery({ queryKey: ['historique', objet?.id], enabled: !!objet, queryFn: () => listerHistorique(objet.id) });
  const emps = useEmplacements(objet?.org_id).data ?? [];
  const photoQ = useQuery({
    queryKey: ['photo', objet?.photo_path], enabled: !!objet?.photo_path,
    queryFn: async () => (await urlsPhotos([objet.photo_path]))[objet.photo_path],
  });

  const [emp, setEmp] = useState('');
  const [etat, setEtat] = useState('');
  const [correction, setCorrection] = useState('');
  const [erreur, setErreur] = useState('');

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ['objet', code] });
    qc.invalidateQueries({ queryKey: ['historique', objet?.id] });
    qc.invalidateQueries({ queryKey: ['objets', objet?.org_id] });
  };
  const run = (fn) => async () => {
    setErreur('');
    try { await fn(); rafraichir(); } catch (e) { setErreur(messageErreur(e)); }
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

  const ecrit = peutEcrire(role);

  return (
    <>
      <p><Link to="/">← Retour au matériel</Link></p>
      <h1>{objet.nom}</h1>
      <p><EtatBadge etat={objet.etat} /> <span className="code-court">{formaterCode(objet.code)}</span></p>
      {photoQ.data && <img className="fiche-photo" src={photoQ.data} alt={`Photo : ${objet.nom}`} />}

      <section className="plai-card">
        <p><strong>Catégorie :</strong> {objet.logi_categories?.nom ?? 'Aucune'}</p>
        <p><strong>Emplacement :</strong> {objet.logi_emplacements?.nom ?? 'Aucun'}</p>
        {objet.notes && <p><strong>Notes :</strong> {objet.notes}</p>}
      </section>

      {erreur && <p className="plai-error" role="alert">{erreur}</p>}

      {ecrit && (
        <section>
          <h2>Actions</h2>
          <div className="actions">
            <Link className="plai-btn btn-lien" to={`/o/${objet.code}/modifier`}>Modifier la fiche</Link>
            <Link className="plai-btn-ghost btn-lien" to={`/etiquettes?codes=${objet.code}`}>Imprimer l'étiquette</Link>
          </div>

          <ChampGuide id="deplacer" label="Déplacer vers" aide="Enregistre le nouvel emplacement et le garde dans l'historique. Les emplacements se créent dans l'administration.">
            <div className="bloc-action">
              <select id="deplacer" aria-describedby="deplacer-aide" className="plai-input" value={emp} onChange={(e) => setEmp(e.target.value)}>
                <option value="">Choisir un emplacement…</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
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
