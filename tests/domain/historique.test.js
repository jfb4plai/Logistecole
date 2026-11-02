import { describe, it, expect } from 'vitest';
import { libelleEvenement } from '../../src/domain/historique.js';

describe('libelleEvenement', () => {
  it('décrit chaque type d\'événement', () => {
    expect(libelleEvenement({ type: 'creation', apres: 'Valise' })).toBe('Création de l\'objet « Valise »');
    expect(libelleEvenement({ type: 'deplacement', avant: 'Salle 12', apres: 'Armoire A' })).toBe('Déplacé de « Salle 12 » vers « Armoire A »');
    expect(libelleEvenement({ type: 'deplacement', avant: null, apres: 'Armoire A' })).toBe('Déplacé de « aucun emplacement » vers « Armoire A »');
    expect(libelleEvenement({ type: 'etat', avant: 'bon', apres: 'defectueux' })).toBe('État : Bon état → Défectueux');
    expect(libelleEvenement({ type: 'modification', commentaire: 'nom', avant: 'A', apres: 'B' })).toBe('Modification de « nom » : « A » → « B »');
    expect(libelleEvenement({ type: 'modification', commentaire: 'photo' })).toBe('Modification de « photo »');
    expect(libelleEvenement({ type: 'correction', commentaire: 'La salle est la 21' })).toBe('Correction : La salle est la 21');
    expect(libelleEvenement({ type: 'note', commentaire: 'Écran fissuré' })).toBe('Note : Écran fissuré');
  });
  it('décrit la vie du prêt, de l\'achat au retour', () => {
    expect(libelleEvenement({ type: 'achat', apres: '15/09/2026', commentaire: 'Fournisseur X' })).toBe('Acheté le 15/09/2026 (Fournisseur X)');
    expect(libelleEvenement({ type: 'achat', apres: '15/09/2026', commentaire: null })).toBe('Acheté le 15/09/2026');
    expect(libelleEvenement({ type: 'pret', apres: 'M.D.', commentaire: 'jusqu\'au 12/11/2026' })).toBe('Prêté à M.D. : jusqu\'au 12/11/2026');
    expect(libelleEvenement({ type: 'pret', apres: null, commentaire: 'Prolongé jusqu\'au 14/11/2026' })).toBe('Prolongé jusqu\'au 14/11/2026');
    expect(libelleEvenement({ type: 'retour', apres: 'defectueux', commentaire: 'Écran fissuré' })).toBe('Rendu, état : Défectueux. Écran fissuré');
    expect(libelleEvenement({ type: 'retour', apres: 'bon', commentaire: null })).toBe('Rendu, état : Bon état');
    expect(libelleEvenement({ type: 'retour_partiel', commentaire: 'Il manque : Tablette 3' })).toBe('Rendu incomplet. Il manque : Tablette 3');
  });
  it('décrit pannes, réparations, stock et réservations', () => {
    expect(libelleEvenement({ type: 'panne', commentaire: 'Ne s\'allume plus' })).toBe('Problème signalé : Ne s\'allume plus');
    expect(libelleEvenement({ type: 'reparation', commentaire: 'Câble remplacé' })).toBe('Réparé : Câble remplacé');
    expect(libelleEvenement({ type: 'reparation', commentaire: null })).toBe('Réparé');
    expect(libelleEvenement({ type: 'stock', avant: '10', apres: '7', commentaire: 'Rentrée' })).toBe('Stock : 10 → 7 (Rentrée)');
    expect(libelleEvenement({ type: 'stock', avant: '7', apres: '4', commentaire: null })).toBe('Stock : 7 → 4');
    expect(libelleEvenement({ type: 'reservation', apres: 'M.D.', commentaire: 'du 05/11/2026 10:00 au 05/11/2026 12:00' })).toBe('Réservé par M.D. : du 05/11/2026 10:00 au 05/11/2026 12:00');
    expect(libelleEvenement({ type: 'reservation', apres: null, commentaire: 'Réservation annulée' })).toBe('Réservation annulée');
  });
  it('ne plante pas sur un type inconnu', () => {
    expect(libelleEvenement({ type: 'futur' })).toBe('Événement');
  });
});
