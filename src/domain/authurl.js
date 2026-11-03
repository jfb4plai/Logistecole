const MESSAGES = {
  otp_expired: 'Ce lien a expiré ou a déjà été utilisé : certaines messageries l\'ouvrent avant vous. Demandez-en un nouveau.',
};
const GENERIQUE = 'Le lien de connexion n\'a pas fonctionné. Demandez-en un nouveau.';

// Supabase renvoie une erreur de lien dans le fragment (#error=…) ou la requête (?error=…).
export function lireErreurLien(adresse) {
  if (!adresse) return null;
  const params = new URLSearchParams(String(adresse).replace(/^[#?]/, ''));
  if (!params.get('error') && !params.get('error_code')) return null;
  const code = params.get('error_code') || params.get('error');
  return { code, message: MESSAGES[code] ?? GENERIQUE };
}

// Page d'arrivée après la connexion : « Matériel », sauf la fiche d'un objet (on y arrive en scannant une étiquette).
// Les pages réservées (administration, suivi…) ne sont jamais le point d'arrivée : un enseignant s'y heurterait à un refus.
export function pageDeRetour(from) {
  return /^\/o\/[A-Za-z0-9-]+$/.test(String(from ?? '')) ? from : '/';
}
