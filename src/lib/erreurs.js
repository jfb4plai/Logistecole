// Jamais de détail technique pour l'utilisateur.
export function messageErreur(err) {
  const code = err?.code ?? err?.status;
  const msg = String(err?.message ?? '');
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Connexion impossible. Vérifiez le réseau et réessayez. Rien n\'a été enregistré.';
  }
  if (code === 'PGRST301' || code === 401 || /jwt/i.test(msg)) return 'Votre session a expiré. Reconnectez-vous.';
  if (code === 429 || code === 'over_email_send_rate_limit') return 'Trop de demandes. Patientez quelques minutes.';
  if (code === '23505') return 'Ce code ou ce nom existe déjà. Réessayez.';
  if (code === '23503') return 'Impossible : cet élément est encore utilisé ailleurs.';
  if (code === '42501' || code === 403) return 'Vous n\'avez pas le droit de faire cette action.';
  // Règles métier écrites en français dans la base (raise exception).
  if (code === 'P0001' && msg) return msg;
  return 'Une erreur est survenue. Réessayez ; si cela continue, prévenez l\'administrateur.';
}
