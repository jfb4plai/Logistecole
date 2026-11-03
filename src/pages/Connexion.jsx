import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { messageErreur } from '../lib/erreurs.js';
import { pageDeRetour } from '../domain/authurl.js';
import { messageConnexionMotDePasse } from '../domain/motdepasse.js';
import ChampGuide from '../components/ChampGuide.jsx';
import Footer from '../components/Footer.jsx';

const CLE_MODE = 'logi_mode_connexion';
const lireMode = () => {
  try { return localStorage.getItem(CLE_MODE) === 'mot_de_passe' ? 'mot_de_passe' : 'lien'; } catch { return 'lien'; }
};
const ecrireMode = (m) => {
  try { localStorage.setItem(CLE_MODE, m); } catch { /* stockage indisponible : on continue sans */ }
};

export default function Connexion() {
  const { session, ready, erreurLien } = useAuth();
  const loc = useLocation();
  const from = pageDeRetour(loc.state?.from);
  const [mode, setMode] = useState(lireMode);
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [etat, setEtat] = useState({ envoi: false, ok: false, erreur: '' });

  if (ready && session) return <Navigate to={from} replace />;

  const choisir = (m) => { setMode(m); ecrireMode(m); setEtat({ envoi: false, ok: false, erreur: '' }); };

  async function envoyerLien(e) {
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

  async function connecter(e) {
    e.preventDefault();
    setEtat({ envoi: true, ok: false, erreur: '' });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: mdp });
    // En cas de succès, la session change et la page redirige toute seule (dans cet onglet comme dans les autres).
    setEtat({ envoi: false, ok: false, erreur: error ? messageConnexionMotDePasse(error) : '' });
  }

  const motDePasse = mode === 'mot_de_passe';

  return (
    <>
      <main className="plai-container page page-connexion">
        <img src="/plai-logo.jpg" alt="PLAI" className="logo-connexion" />
        <h1>Logistécole</h1>
        <p className="accroche">Le matériel de votre école, retrouvé en deux scans. Gratuit pour les écoles.</p>
        <div className="onglets-admin" role="tablist" aria-label="Façon de se connecter">
          <button type="button" role="tab" aria-selected={!motDePasse} className={!motDePasse ? 'plai-btn' : 'plai-btn-ghost'} onClick={() => choisir('lien')}>Par lien e-mail</button>
          <button type="button" role="tab" aria-selected={motDePasse} className={motDePasse ? 'plai-btn' : 'plai-btn-ghost'} onClick={() => choisir('mot_de_passe')}>Avec mon mot de passe</button>
        </div>
        <form className="plai-card" onSubmit={motDePasse ? connecter : envoyerLien}>
          <ChampGuide
            id="email"
            label="Votre adresse e-mail"
            aide={motDePasse
              ? 'L\'adresse avec laquelle vous avez été invité·e par l\'administrateur de votre école ou du Pôle.'
              : 'Vous recevez un lien de connexion à cette adresse, sans mot de passe à retenir. Il faut avoir été invité·e par l\'administrateur de votre école ou du Pôle.'}
            obligatoire
          >
            <input
              id="email" type="email" required autoComplete="username" className="plai-input"
              placeholder="prenom.nom@ecole-liege.be" aria-describedby="email-aide"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </ChampGuide>
          {motDePasse && (
            <ChampGuide
              id="mdp"
              label="Votre mot de passe"
              aide="Pas encore de mot de passe ? Connectez-vous une première fois par lien e-mail, puis créez-le dans « Mon compte » (réservé aux administrateurs et gestionnaires)."
              obligatoire
            >
              <input
                id="mdp" type="password" required autoComplete="current-password" className="plai-input"
                aria-describedby="mdp-aide" value={mdp} onChange={(e) => setMdp(e.target.value)}
              />
            </ChampGuide>
          )}
          {erreurLien && !etat.erreur && <p className="plai-error" role="alert">{erreurLien.message}</p>}
          {etat.erreur && <p className="plai-error" role="alert">{etat.erreur}</p>}
          {etat.ok && (
            <p className="plai-success" role="status">
              Si cette adresse est autorisée, un lien de connexion vient d'être envoyé. Ouvrez-le sur cet appareil. Pensez à regarder les courriers indésirables.
            </p>
          )}
          <button className="plai-btn" disabled={etat.envoi}>
            {etat.envoi ? (motDePasse ? 'Connexion…' : 'Envoi…') : motDePasse ? 'Me connecter' : 'Recevoir mon lien de connexion'}
          </button>
        </form>
      </main>
      <Footer />
    </>
  );
}
