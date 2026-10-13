import { libelleEtat } from './etats.js';

export function libelleEvenement(ev) {
  switch (ev.type) {
    case 'creation':
      return `Création de l'objet « ${ev.apres} »`;
    case 'deplacement':
      return `Déplacé de « ${ev.avant ?? 'aucun emplacement'} » vers « ${ev.apres ?? 'aucun emplacement'} »`;
    case 'etat':
      return `État : ${libelleEtat(ev.avant)} → ${libelleEtat(ev.apres)}`;
    case 'modification':
      return ev.avant != null || ev.apres != null
        ? `Modification de « ${ev.commentaire} » : « ${ev.avant ?? ''} » → « ${ev.apres ?? ''} »`
        : `Modification de « ${ev.commentaire} »`;
    case 'correction':
      return `Correction : ${ev.commentaire}`;
    case 'note':
      return `Note : ${ev.commentaire}`;
    default:
      return 'Événement';
  }
}
