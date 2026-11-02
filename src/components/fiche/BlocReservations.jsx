import { useState } from 'react';
import { reserver, annulerReservation } from '../../data/prets.js';
import { validerCreneau } from '../../domain/creneau.js';
import { peutEcrire } from '../../domain/permissions.js';
import { messageErreur } from '../../lib/erreurs.js';
import ChampGuide from '../ChampGuide.jsx';

const format = (iso) => new Date(iso).toLocaleString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function BlocReservations({ objet, reservations, actions, role, userId, emprunteurs, surChangement }) {
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [pour, setPour] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [occupe, setOccupe] = useState(false);
  const liste = reservations.filter((r) => r.objet_id === objet.id);

  async function agir(fn, message) {
    setErreur(''); setInfo(''); setOccupe(true);
    try { await fn(); setInfo(message); await surChangement(); } catch (e) { setErreur(messageErreur(e)); } finally { setOccupe(false); }
  }

  if (!actions.reserver && liste.length === 0) return null;

  return (
    <section className="plai-card bloc">
      <h2>Réservations</h2>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {info && <p className="plai-success" role="status">{info}</p>}
      {liste.length === 0 ? <p className="champ-aide">Aucune réservation à venir.</p> : (
        <ul className="historique">
          {liste.map((r) => (
            <li key={r.id}>
              <strong>{r.logi_emprunteurs?.libelle}</strong>
              <time>Du {format(r.debut)} au {format(r.fin)}</time>
              {(peutEcrire(role) || r.logi_emprunteurs?.compte_id === userId) && (
                <button className="plai-btn-ghost" disabled={occupe} onClick={() => agir(() => annulerReservation(r.id), 'Réservation annulée.')}>Annuler</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {actions.reserver && (
        <>
          <ChampGuide id="resa-debut" label="Début" aide="Quand vous prendrez l'objet. Impossible de réserver un créneau déjà pris, ni pendant un prêt.">
            <input id="resa-debut" type="datetime-local" aria-describedby="resa-debut-aide" className="plai-input" value={debut} onChange={(e) => setDebut(e.target.value)} />
          </ChampGuide>
          <ChampGuide id="resa-fin" label="Fin" aide="Quand vous le rendrez. Une réservation dure 30 jours au plus.">
            <input id="resa-fin" type="datetime-local" aria-describedby="resa-fin-aide" className="plai-input" value={fin} onChange={(e) => setFin(e.target.value)} />
          </ChampGuide>
          {peutEcrire(role) && (
            <ChampGuide id="resa-pour" label="Réserver pour (facultatif)" aide="Laissez vide pour réserver à votre propre nom.">
              <select id="resa-pour" aria-describedby="resa-pour-aide" className="plai-input" value={pour} onChange={(e) => setPour(e.target.value)}>
                <option value="">Moi</option>
                {emprunteurs.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
              </select>
            </ChampGuide>
          )}
          <div className="actions">
            <button className="plai-btn" disabled={occupe} onClick={() => {
              const c = validerCreneau({ debut, fin });
              if (!c.ok) { setErreur(c.erreur); return; }
              agir(async () => { await reserver(objet.id, c.debut, c.fin, pour || null); setDebut(''); setFin(''); }, 'Réservation enregistrée.');
            }}>Réserver</button>
          </div>
        </>
      )}
    </section>
  );
}
