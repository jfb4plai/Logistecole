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
  it('ne plante pas sur un type inconnu', () => {
    expect(libelleEvenement({ type: 'futur' })).toBe('Événement');
  });
});
