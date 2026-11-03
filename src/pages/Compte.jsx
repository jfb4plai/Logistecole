import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import { peutEcrire } from '../domain/permissions.js';
import { MIN_MOT_DE_PASSE, validerMotDePasse, messageChangementMotDePasse } from '../domain/motdepasse.js';
import ChampGuide from '../components/ChampGuide.jsx';

// Mot de passe permanent pour les administrateurs et les membres du Pôle (gestionnaires).
// Le compte Supabase est commun à toutes les apps du projet : réserver cette page à certains rôles est une règle d'affichage, pas une protection.
export default function Compte() {
  const { session } = useAuth();
  const { role } = useOrg();
  const [mdp, setMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [etat, setEtat] = useState({ envoi: false, ok: false, erreur: '' });

  if (!peutEcrire(role)) {
    return (
      <div className="plai-card">
        <h1>Mon compte</h1>
        <p>Le mot de passe est réservé aux administrateurs et aux gestionnaires du Pôle. Vous vous connectez avec le lien envoyé à votre adresse e-mail.</p>
      </div>
    );
  }

  async function enregistrer(e) {
    e.preventDefault();
    const verdict = validerMotDePasse(mdp, confirmation, session?.user?.email);
    if (!verdict.ok) { setEtat({ envoi: false, ok: false, erreur: verdict.erreurs.join(' ') }); return; }
    setEtat({ envoi: true, ok: false, erreur: '' });
    const { error } = await supabase.auth.updateUser({ password: mdp });
    if (error) { setEtat({ envoi: false, ok: false, erreur: messageChangementMotDePasse(error) }); return; }
    setMdp('');
    setConfirmation('');
    setEtat({ envoi: false, ok: true, erreur: '' });
  }

  return (
    <>
      <h1>Mon compte</h1>
      <p className="accroche">Adresse de connexion : <strong>{session?.user?.email}</strong></p>
      <form className="plai-card" onSubmit={enregistrer}>
        <h2>Mot de passe</h2>
        <p className="champ-aide">
          Avec un mot de passe, vous vous connectez directement, sans attendre un e-mail. Le lien par e-mail reste possible à tout moment.
          Votre compte est lié à votre adresse : les autres outils du Pôle qui utilisent la même adresse e-mail partagent ce compte.
        </p>
        <ChampGuide id="nouveau-mdp" label="Nouveau mot de passe" obligatoire
          aide={`Au moins ${MIN_MOT_DE_PASSE} caractères. Une phrase courte est plus facile à retenir et plus solide qu'un mot compliqué.`}>
          <input id="nouveau-mdp" type="password" autoComplete="new-password" className="plai-input" aria-describedby="nouveau-mdp-aide"
            placeholder="Ex. : trois phrases courtes mises bout à bout" value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </ChampGuide>
        <ChampGuide id="confirmation-mdp" label="Confirmez le mot de passe" obligatoire aide="Retapez-le à l'identique, pour éviter une faute de frappe.">
          <input id="confirmation-mdp" type="password" autoComplete="new-password" className="plai-input" aria-describedby="confirmation-mdp-aide"
            value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </ChampGuide>
        {etat.erreur && <p className="plai-error" role="alert">{etat.erreur}</p>}
        {etat.ok && <p className="plai-success" role="status">Mot de passe enregistré. Vous pouvez maintenant vous connecter avec votre adresse et ce mot de passe.</p>}
        <button className="plai-btn" disabled={etat.envoi}>{etat.envoi ? 'Enregistrement…' : 'Enregistrer mon mot de passe'}</button>
      </form>
    </>
  );
}
