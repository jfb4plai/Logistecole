const pad = (n) => String(n).padStart(2, '0');

export const dateIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function echeanceParDefaut(now = new Date(), jours = 7) {
  return dateIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + jours));
}

function jourLocal(iso) {
  const [a, m, j] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, j);
}

const formatLong = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });

// L'heure de la journée est ignorée : on compare des jours calendaires.
export function statutPret({ echeance }, now = new Date()) {
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const jours = Math.round((jourLocal(echeance) - aujourdhui) / 86400000);
  if (jours < 0) return { niveau: 'retard', jours, libelle: `En retard de ${-jours} jour${jours === -1 ? '' : 's'}` };
  if (jours === 0) return { niveau: 'bientot', jours, libelle: 'À rendre aujourd\'hui' };
  if (jours === 1) return { niveau: 'bientot', jours, libelle: 'À rendre demain' };
  return { niveau: 'ok', jours, libelle: `À rendre le ${formatLong.format(jourLocal(echeance))}` };
}
