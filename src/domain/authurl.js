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
