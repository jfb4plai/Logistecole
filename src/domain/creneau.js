const parse = (s) => {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Mêmes limites que la base : fin après début, début pas passé de plus d'une heure, 30 jours au plus.
export function validerCreneau({ debut, fin }, now = new Date()) {
  const d = parse(debut);
  const f = parse(fin);
  if (!d || !f) return { ok: false, erreur: 'Indiquez le début et la fin du créneau.' };
  if (f <= d) return { ok: false, erreur: 'La fin doit être après le début.' };
  if (d.getTime() < now.getTime() - 3600000) return { ok: false, erreur: 'Le début est déjà passé.' };
  if (f.getTime() - d.getTime() > 30 * 86400000) return { ok: false, erreur: 'Une réservation dure 30 jours au plus.' };
  return { ok: true, debut: d.toISOString(), fin: f.toISOString() };
}
