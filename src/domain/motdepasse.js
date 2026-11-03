import { messageErreur } from '../lib/erreurs.js';

export const MIN_MOT_DE_PASSE = 12;

// Les espaces ne sont pas rognés : une phrase de passe peut en contenir.
export function validerMotDePasse(mdp, confirmation, email) {
  const erreurs = [];
  if (String(mdp).length < MIN_MOT_DE_PASSE) erreurs.push(`Le mot de passe doit faire au moins ${MIN_MOT_DE_PASSE} caractères. Une phrase courte convient très bien.`);
  if (mdp !== confirmation) erreurs.push('Les deux mots de passe ne sont pas identiques.');
  if (email && String(mdp).toLowerCase() === String(email).toLowerCase()) erreurs.push('Le mot de passe ne peut pas être votre adresse e-mail.');
  return erreurs.length ? { ok: false, erreurs } : { ok: true };
}

// On ne dit pas si c'est l'adresse ou le mot de passe qui est faux.
export function messageConnexionMotDePasse(err) {
  if (err?.code === 'invalid_credentials') {
    return 'Adresse ou mot de passe incorrect. Si vous n\'avez pas encore de mot de passe, utilisez le lien par e-mail : vous pourrez en créer un ensuite dans « Mon compte ».';
  }
  return messageErreur(err);
}

export function messageChangementMotDePasse(err) {
  if (err?.code === 'same_password') return 'Ce mot de passe est déjà le vôtre. Choisissez-en un autre.';
  if (err?.code === 'weak_password') return 'Ce mot de passe est trop faible ou trop courant. Choisissez une phrase plus longue.';
  if (err?.code === 'reauthentication_needed') return 'Pour changer de mot de passe, reconnectez-vous d\'abord avec le lien e-mail, puis réessayez.';
  return messageErreur(err);
}
