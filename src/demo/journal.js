import { historique, objets } from './store.js';

// Le journal de démonstration reprend l'historique de la valise et ajoute quelques événements d'autres objets.
export async function listerJournal() {
  const autres = [
    { id: 20, objet_id: 'P', type: 'panne', avant: null, apres: null, commentaire: 'écran noir après la charge', quand: new Date(Date.now() - 3600000).toISOString(), auteur_email: 'prof.martin@ecole.be', logi_objets: { nom: 'Projecteur numérique', code: 'PPPP2222' } },
    { id: 19, objet_id: 'C', type: 'stock', avant: '10', apres: '4', commentaire: 'rentrée', quand: new Date(Date.now() - 90000000).toISOString(), auteur_email: 'gestion@ecole.be', logi_objets: { nom: 'Piles AA', code: 'CCCC2222' } },
  ];
  const k = objets.find((o) => o.id === 'K');
  const deLaValise = historique.map((e) => ({ ...e, objet_id: 'K', logi_objets: { nom: k.nom, code: k.code } }));
  return JSON.parse(JSON.stringify([...autres, ...deLaValise].sort((a, b) => b.id - a.id)));
}
