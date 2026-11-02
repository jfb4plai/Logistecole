import { useState } from 'react';
import { signaler, reparer } from '../../data/prets.js';
import { messageErreur } from '../../lib/erreurs.js';
import ChampGuide from '../ChampGuide.jsx';

export default function BlocPanne({ objet, actions, surChangement }) {
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [occupe, setOccupe] = useState(false);

  async function agir(fn, message) {
    setErreur(''); setInfo(''); setOccupe(true);
    try { await fn(); setInfo(message); setTexte(''); await surChangement(); } catch (e) { setErreur(messageErreur(e)); } finally { setOccupe(false); }
  }

  if (!actions.signaler && !actions.reparer) return null;
  return (
    <section className="plai-card bloc">
      <h2>{actions.reparer ? 'Réparation' : 'Signaler un problème'}</h2>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {info && <p className="plai-success" role="status">{info}</p>}
      {actions.signaler && (
        <ChampGuide id="panne" label="Ce qui ne va pas" aide="L'objet passe en « défectueux » et n'est plus prêtable tant qu'un gestionnaire ne l'a pas remis en état. Le message reste dans l'historique.">
          <div className="bloc-action">
            <input id="panne" aria-describedby="panne-aide" className="plai-input" maxLength={300} placeholder="Ex. : l'écran reste noir après la charge"
              value={texte} onChange={(e) => setTexte(e.target.value)} />
            <button className="plai-btn-ghost" disabled={occupe || !texte.trim()} onClick={() => agir(() => signaler(objet.id, texte.trim()), 'Problème signalé.')}>Signaler</button>
          </div>
        </ChampGuide>
      )}
      {actions.reparer && (
        <ChampGuide id="reparation" label="Ce qui a été fait" aide="L'objet repasse en « bon état » et redevient prêtable. Écrivez la réparation (câble changé, retour sous garantie…).">
          <div className="bloc-action">
            <input id="reparation" aria-describedby="reparation-aide" className="plai-input" maxLength={300} placeholder="Ex. : câble remplacé, testé avec la valise"
              value={texte} onChange={(e) => setTexte(e.target.value)} />
            <button className="plai-btn" disabled={occupe} onClick={() => agir(() => reparer(objet.id, texte.trim() || null), 'Objet remis en bon état.')}>Marquer réparé</button>
          </div>
        </ChampGuide>
      )}
    </section>
  );
}
