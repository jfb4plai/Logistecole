import { useState } from 'react';
import { ajusterStock } from '../../data/prets.js';
import { estSousSeuil } from '../../domain/stock.js';
import { messageErreur } from '../../lib/erreurs.js';
import ChampGuide from '../ChampGuide.jsx';

export default function BlocStock({ objet, actions, surChangement }) {
  const [delta, setDelta] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  if (!objet.consommable) return null;
  const bas = estSousSeuil(objet);
  const n = Number(delta);

  async function enregistrer() {
    setErreur('');
    if (!Number.isInteger(n) || n === 0) { setErreur('Indiquez un nombre entier différent de zéro (par exemple -3 ou 10).'); return; }
    setOccupe(true);
    try { await ajusterStock(objet.id, n, commentaire.trim() || null); setDelta(''); setCommentaire(''); await surChangement(); } catch (e) { setErreur(messageErreur(e)); } finally { setOccupe(false); }
  }

  return (
    <section className="plai-card bloc">
      <h2>Stock</h2>
      <p>
        <strong>{objet.quantite} en stock</strong>
        {objet.seuil_min != null && <> · seuil minimum {objet.seuil_min}</>}{' '}
        {bas && <span className="badge-etat badge-alerte">Sous le seuil : à racheter</span>}
      </p>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {actions.ajusterStock && (
        <>
          <ChampGuide id="delta" label="Variation du stock" aide="Un nombre positif pour une entrée (achat, don), négatif pour une sortie (consommé, perdu). Le stock ne peut pas descendre sous zéro.">
            <input id="delta" aria-describedby="delta-aide" className="plai-input" inputMode="numeric" placeholder="Ex. : -3 ou 10" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </ChampGuide>
          <ChampGuide id="motif-stock" label="Motif (facultatif)" aide="Gardé dans l'historique du stock.">
            <input id="motif-stock" aria-describedby="motif-stock-aide" className="plai-input" maxLength={300} placeholder="Ex. : distribution de la rentrée" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </ChampGuide>
          <div className="actions"><button className="plai-btn" disabled={occupe} onClick={enregistrer}>Enregistrer le mouvement</button></div>
        </>
      )}
    </section>
  );
}
