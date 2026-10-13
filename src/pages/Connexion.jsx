import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';
import Footer from '../components/Footer.jsx';

export default function Connexion() {
  const { session, ready } = useAuth();
  const loc = useLocation();
  const from = loc.state?.from ?? '/';
  const [email, setEmail] = useState('');
  const [etat, setEtat] = useState({ envoi: false, ok: false, erreur: '' });

  if (ready && session) return <Navigate to={from} replace />;

  async function envoyer(e) {
    e.preventDefault();
    setEtat({ envoi: true, ok: false, erreur: '' });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + from },
    });
    // Message identique que l'adresse soit connue ou non : on ne révèle pas qui a un compte.
    const inconnu = error && (error.status === 400 || /signups not allowed|not found/i.test(error.message ?? ''));
    if (error && !inconnu) setEtat({ envoi: false, ok: false, erreur: messageErreur(error) });
    else setEtat({ envoi: false, ok: true, erreur: '' });
  }

  return (
    <>
      <main className="plai-container page page-connexion">
        <img src="/plai-logo.jpg" alt="PLAI" className="logo-connexion" />
        <h1>Logistécole</h1>
        <p className="accroche">Le matériel de votre école, retrouvé en deux scans. Gratuit pour les écoles.</p>
        <form className="plai-card" onSubmit={envoyer}>
          <ChampGuide
            id="email"
            label="Votre adresse e-mail"
            aide="Vous recevez un lien de connexion à cette adresse, sans mot de passe à retenir. Il faut avoir été invité·e par l'administrateur de votre école ou du Pôle."
            obligatoire
          >
            <input
              id="email" type="email" required autoComplete="email" className="plai-input"
              placeholder="prenom.nom@ecole-liege.be" aria-describedby="email-aide"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </ChampGuide>
          {etat.erreur && <p className="plai-error" role="alert">{etat.erreur}</p>}
          {etat.ok && (
            <p className="plai-success" role="status">
              Si cette adresse est autorisée, un lien de connexion vient d'être envoyé. Ouvrez-le sur cet appareil. Pensez à regarder les courriers indésirables.
            </p>
          )}
          <button className="plai-btn" disabled={etat.envoi}>{etat.envoi ? 'Envoi…' : 'Recevoir mon lien de connexion'}</button>
        </form>
      </main>
      <Footer />
    </>
  );
}
