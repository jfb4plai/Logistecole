import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import { usePrets, useReservations } from '../data/hooks.js';
import { statutPret } from '../domain/echeance.js';
import { messageErreur } from '../lib/erreurs.js';

const ton = { retard: 'alerte', bientot: 'attention', ok: 'ok' };
const format = (iso) => new Date(iso).toLocaleString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function MesEmprunts() {
  const { session } = useAuth();
  const { orgId } = useOrg();
  const pretsQ = usePrets(orgId, { ouverts: true });
  const resaQ = useReservations(orgId);
  const userId = session?.user?.id;

  const mes = (pretsQ.data ?? []).filter((p) => p.logi_emprunteurs?.compte_id === userId);
  const groupes = Object.values(mes.reduce((acc, p) => { (acc[p.groupe_id] ??= []).push(p); return acc; }, {}))
    .map((g) => ({ racine: g.find((p) => !p.logi_objets?.parent_id) ?? g[0], elements: g.filter((p) => p.logi_objets?.parent_id) }))
    .sort((a, b) => a.racine.echeance.localeCompare(b.racine.echeance));
  const mesResa = (resaQ.data ?? []).filter((r) => r.logi_emprunteurs?.compte_id === userId);

  return (
    <>
      <h1>Mes emprunts</h1>
      {pretsQ.error && <p className="plai-error" role="alert">{messageErreur(pretsQ.error)}</p>}
      {pretsQ.isLoading && <p className="chargement">Chargement…</p>}
      {!pretsQ.isLoading && groupes.length === 0 && (
        <div className="plai-empty">
          Vous n'avez rien emprunté pour le moment.
          <p><Link to="/scan" className="plai-btn btn-lien">Scanner une étiquette</Link></p>
        </div>
      )}
      <ul className="liste-objets">
        {groupes.map(({ racine, elements }) => {
          const s = statutPret(racine);
          return (
            <li key={racine.id}>
              <Link to={`/o/${racine.logi_objets?.code}`} className="ligne-objet">
                <span className="ligne-texte">
                  <strong>{racine.logi_objets?.nom}</strong>
                  <span className="meta">{s.libelle}{elements.length > 0 && ` · avec ${elements.length} élément${elements.length > 1 ? 's' : ''}`}</span>
                </span>
                <span className={`badge-etat badge-${ton[s.niveau]}`}>{s.niveau === 'retard' ? 'En retard' : s.niveau === 'bientot' ? 'Bientôt' : 'En cours'}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {mesResa.length > 0 && (
        <>
          <h2>Mes réservations</h2>
          <ul className="liste-objets">
            {mesResa.map((r) => (
              <li key={r.id}>
                <Link to={`/o/${r.logi_objets?.code}`} className="ligne-objet">
                  <span className="ligne-texte"><strong>{r.logi_objets?.nom}</strong><span className="meta">Du {format(r.debut)} au {format(r.fin)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
