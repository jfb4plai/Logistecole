import { Link } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets, usePrets, useReservations } from '../data/hooks.js';
import { statutPret } from '../domain/echeance.js';
import { formaterCode } from '../domain/codes.js';
import { pretsEnCours } from '../domain/kit.js';
import { estSousSeuil } from '../domain/stock.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';

const ton = { retard: 'alerte', bientot: 'attention', ok: 'ok' };
const format = (iso) => new Date(iso).toLocaleString('fr-BE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function Suivi() {
  const { orgId, role } = useOrg();
  const pretsQ = usePrets(orgId, { ouverts: true });
  const objetsQ = useObjets(orgId);
  const resaQ = useReservations(orgId);

  if (role === 'emprunteur') {
    return <div className="plai-card"><h1>Suivi</h1><p>Le suivi de l'organisation est réservé aux gestionnaires. Vos prêts sont dans <Link to="/emprunts">Mes emprunts</Link>.</p></div>;
  }

  const enCours = pretsEnCours(pretsQ.data ?? []).map((p) => ({ pret: p, statut: statutPret(p) })).sort((a, b) => a.pret.echeance.localeCompare(b.pret.echeance));
  const enRetard = enCours.filter((x) => x.statut.niveau === 'retard').length;
  const objets = objetsQ.data ?? [];
  const aReparer = objets.filter((o) => o.etat === 'defectueux');
  const stockBas = objets.filter(estSousSeuil);
  const resas = resaQ.data ?? [];
  const erreur = pretsQ.error || objetsQ.error || resaQ.error;

  return (
    <>
      <h1>Suivi</h1>
      {erreur && <p className="plai-error" role="alert">{messageErreur(erreur)}</p>}

      <section>
        <h2>Prêts en cours</h2>
        <p>{enCours.length} prêt{enCours.length > 1 ? 's' : ''} en cours{enRetard > 0 && <>, dont <strong>{enRetard} en retard</strong></>}.</p>
        {enCours.length === 0 ? <p className="plai-empty">Rien n'est prêté.</p> : (
          <ul className="liste-objets">
            {enCours.map(({ pret, statut }) => (
              <li key={pret.id}>
                <Link to={`/o/${pret.logi_objets?.code}`} className="ligne-objet">
                  <span className="ligne-texte"><strong>{pret.logi_objets?.nom}</strong><span className="meta">{pret.manquant && `Élément non rendu du kit · ${formaterCode(pret.logi_objets?.code ?? '')} · `}{pret.logi_emprunteurs?.libelle} · {statut.libelle}</span></span>
                  <span className={`badge-etat badge-${ton[statut.niveau]}`}>{statut.niveau === 'retard' ? 'En retard' : statut.niveau === 'bientot' ? 'Bientôt' : 'En cours'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>À réparer</h2>
        {aReparer.length === 0 ? <p className="plai-empty">Aucun objet défectueux.</p> : (
          <ul className="liste-objets">
            {aReparer.map((o) => (
              <li key={o.id}>
                <Link to={`/o/${o.code}`} className="ligne-objet">
                  <span className="ligne-texte"><strong>{o.nom}</strong><span className="meta code-court">{formaterCode(o.code)}</span></span>
                  <EtatBadge etat={o.etat} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Stock à racheter</h2>
        {stockBas.length === 0 ? <p className="plai-empty">Aucun consommable sous son seuil.</p> : (
          <ul className="liste-objets">
            {stockBas.map((o) => (
              <li key={o.id}>
                <Link to={`/o/${o.code}`} className="ligne-objet">
                  <span className="ligne-texte"><strong>{o.nom}</strong><span className="meta">{o.quantite} en stock · seuil {o.seuil_min}</span></span>
                  <span className="badge-etat badge-alerte">À racheter</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Réservations à venir</h2>
        {resas.length === 0 ? <p className="plai-empty">Aucune réservation.</p> : (
          <ul className="liste-objets">
            {resas.map((r) => (
              <li key={r.id}>
                <Link to={`/o/${r.logi_objets?.code}`} className="ligne-objet">
                  <span className="ligne-texte"><strong>{r.logi_objets?.nom}</strong><span className="meta">{r.logi_emprunteurs?.libelle} · {format(r.debut)} → {format(r.fin)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
