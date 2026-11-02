export const ETATS = [
  { value: 'neuf', label: 'Neuf', ton: 'ok' },
  { value: 'bon', label: 'Bon état', ton: 'ok' },
  { value: 'use', label: 'Usé', ton: 'attention' },
  { value: 'defectueux', label: 'Défectueux', ton: 'alerte' },
  { value: 'perdu', label: 'Perdu', ton: 'alerte' },
  { value: 'sorti', label: 'Sorti de l\'inventaire', ton: 'neutre' },
];

export function libelleEtat(value) {
  return ETATS.find((e) => e.value === value)?.label ?? value ?? '';
}

// États dans lesquels un objet se prête et se réserve.
export const ETATS_PRETABLES = ['neuf', 'bon', 'use'];
// États qu'on peut déclarer au retour d'un prêt : tous sauf « sorti » (le rebut se décide ailleurs).
export const ETATS_RETOUR = ETATS.filter((e) => e.value !== 'sorti');

const RANG_ETAT = { neuf: 4, bon: 3, use: 2, defectueux: 1, perdu: 0 };

// Un objet ne s'améliore pas au retour : on propose son état actuel et les états moins bons.
export function etatsRetourPossibles(etatActuel) {
  const rang = RANG_ETAT[etatActuel] ?? RANG_ETAT.bon;
  return ETATS_RETOUR.filter((e) => RANG_ETAT[e.value] <= rang);
}
