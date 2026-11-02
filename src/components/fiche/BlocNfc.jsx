import { useState } from 'react';
import { comparerEtiquette, ecrireEtiquette, lireEtiquette, nfcSupported, nfcVerrouillageSupporte, objetUrl } from '../../lib/nfc.js';

const MESSAGES = {
  NFC_UNSUPPORTED: 'Ce navigateur ne sait pas écrire une puce. Utilisez Chrome sur un téléphone Android.',
  LOCK_UNSUPPORTED: 'Ce navigateur ne propose pas le verrouillage.',
  TIMEOUT: 'Aucune puce détectée. Posez-la contre le dos du téléphone et réessayez.',
  UNREADABLE: 'La puce n\'a pas pu être lue.',
  NotAllowedError: 'L\'écriture NFC n\'est pas autorisée : acceptez la demande du navigateur.',
  NotSupportedError: 'Le NFC n\'est pas disponible ou pas activé sur ce téléphone.',
};
const texte = (e) => MESSAGES[e?.message] ?? MESSAGES[e?.name] ?? 'Opération NFC impossible. Réessayez.';

export default function BlocNfc({ objet }) {
  const [verrouiller, setVerrouiller] = useState(false);
  const [message, setMessage] = useState({ type: '', texte: '' });
  const [occupe, setOccupe] = useState(false);

  async function ecrire() {
    setMessage({ type: '', texte: '' }); setOccupe(true);
    try {
      await ecrireEtiquette(objetUrl(objet.code, window.location.origin), { verrouiller });
      setMessage({ type: 'ok', texte: 'Puce écrite. Approchez-la du téléphone pour vérifier qu\'elle ouvre cette fiche.' });
    } catch (e) { setMessage({ type: 'erreur', texte: texte(e) }); } finally { setOccupe(false); }
  }

  async function verifier() {
    setMessage({ type: '', texte: '' }); setOccupe(true);
    try {
      const r = comparerEtiquette(await lireEtiquette(), objet.code);
      const textes = {
        identique: ['ok', 'Cette puce ouvre bien cette fiche.'],
        vide: ['erreur', 'Cette puce est vide.'],
        autre: ['erreur', `Cette puce ouvre un autre objet (${r.codeTrouve}).`],
        etrangere: ['erreur', 'Cette puce ne contient pas une adresse Logistécole.'],
      };
      setMessage({ type: textes[r.statut][0], texte: textes[r.statut][1] });
    } catch (e) { setMessage({ type: 'erreur', texte: texte(e) }); } finally { setOccupe(false); }
  }

  return (
    <section className="plai-card bloc">
      <h2>Puce NFC (facultative)</h2>
      {!nfcSupported() ? (
        <p className="champ-aide">Pour écrire une puce, ouvrez cette fiche avec Chrome sur un téléphone Android. Le QR code imprimé fonctionne partout et suffit.</p>
      ) : (
        <>
          <p className="champ-aide">La puce contient seulement l'adresse de cette fiche, comme le QR code. Posez-la contre le dos du téléphone au moment de l'écriture.</p>
          {nfcVerrouillageSupporte() && (
            <label className="liste-cases">
              <span><input type="checkbox" checked={verrouiller} onChange={(e) => setVerrouiller(e.target.checked)} /> Verrouiller la puce après l'écriture (définitif : personne ne pourra plus la réécrire)</span>
            </label>
          )}
          <div className="actions">
            <button className="plai-btn" disabled={occupe} onClick={ecrire}>Écrire la puce</button>
            <button className="plai-btn-ghost" disabled={occupe} onClick={verifier}>Vérifier une puce</button>
          </div>
        </>
      )}
      {message.texte && <p className={message.type === 'ok' ? 'plai-success' : 'plai-error'} role="status">{message.texte}</p>}
    </section>
  );
}
