export const ETATS = [
  { value: 'bon', label: 'Bon état', ton: 'ok' },
  { value: 'use', label: 'Usé', ton: 'attention' },
  { value: 'defectueux', label: 'Défectueux', ton: 'alerte' },
  { value: 'perdu', label: 'Perdu', ton: 'alerte' },
  { value: 'sorti', label: 'Sorti de l\'inventaire', ton: 'neutre' },
];

export function libelleEtat(value) {
  return ETATS.find((e) => e.value === value)?.label ?? value ?? '';
}
