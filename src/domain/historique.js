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
    case 'achat':
      return `Acheté le ${ev.apres}${ev.commentaire ? ` (${ev.commentaire})` : ''}`;
    case 'pret':
      return ev.apres ? `Prêté à ${ev.apres} : ${ev.commentaire}` : ev.commentaire;
    case 'retour':
      return `Rendu, état : ${libelleEtat(ev.apres)}${ev.commentaire ? `. ${ev.commentaire}` : ''}`;
    case 'retour_partiel':
      return `Rendu incomplet. ${ev.commentaire}`;
    case 'panne':
      return `Problème signalé : ${ev.commentaire}`;
    case 'reparation':
      return ev.commentaire ? `Réparé : ${ev.commentaire}` : 'Réparé';
    case 'stock':
      return `Stock : ${ev.avant} → ${ev.apres}${ev.commentaire ? ` (${ev.commentaire})` : ''}`;
    case 'reservation':
      return ev.apres ? `Réservé par ${ev.apres} : ${ev.commentaire}` : ev.commentaire;
    default:
      return 'Événement';
  }
}
