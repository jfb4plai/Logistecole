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
// États qu'on peut déclarer au retour d'un prêt (jamais « neuf » ni « sorti »).
export const ETATS_RETOUR = ETATS.filter((e) => ['bon', 'use', 'defectueux', 'perdu'].includes(e.value));
