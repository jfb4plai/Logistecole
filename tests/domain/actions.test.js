import { describe, it, expect } from 'vitest';
import { actionsFiche } from '../../src/domain/actions.js';

const objet = (o = {}) => ({ id: 'o1', etat: 'bon', parent_id: null, consommable: false, ...o });
const pretOuvert = { id: 'p1', objet_id: 'o1', retour_le: null };

describe('actionsFiche', () => {
  it('un enseignant peut emprunter et réserver un objet libre, rien d\'autre', () => {
    const a = actionsFiche({ objet: objet(), role: 'emprunteur', prets: [], estMonPret: false });
    expect(a).toMatchObject({ emprunter: true, reserver: true, signaler: true, preter: false, rendre: false, modifier: false, reparer: false, ajusterStock: false, ecrireNfc: false });
  });
  it('un gestionnaire peut prêter, emprunter, modifier, écrire une puce', () => {
    const a = actionsFiche({ objet: objet(), role: 'gestionnaire', prets: [], estMonPret: false });
    expect(a).toMatchObject({ preter: true, emprunter: true, modifier: true, ecrireNfc: true, rendre: false });
  });
  it('le rôle lecture ne fait que consulter et signaler', () => {
    const a = actionsFiche({ objet: objet(), role: 'lecture', prets: [], estMonPret: false });
    expect(a).toMatchObject({ emprunter: false, preter: false, reserver: false, modifier: false, signaler: true });
  });
  it('objet prêté : plus d\'emprunt ni de prêt ; le titulaire et le gestionnaire peuvent rendre et prolonger', () => {
    const base = { objet: objet(), prets: [pretOuvert] };
    expect(actionsFiche({ ...base, role: 'emprunteur', estMonPret: true })).toMatchObject({ emprunter: false, preter: false, rendre: true, prolonger: true });
    expect(actionsFiche({ ...base, role: 'emprunteur', estMonPret: false })).toMatchObject({ rendre: false, prolonger: false });
    expect(actionsFiche({ ...base, role: 'gestionnaire', estMonPret: false })).toMatchObject({ rendre: true, prolonger: true, preter: false });
  });
  it('objet défectueux : pas de prêt, réparation par le gestionnaire seulement', () => {
    const base = { objet: objet({ etat: 'defectueux' }), prets: [] };
    expect(actionsFiche({ ...base, role: 'emprunteur', estMonPret: false })).toMatchObject({ emprunter: false, reserver: false, signaler: false, reparer: false });
    expect(actionsFiche({ ...base, role: 'gestionnaire', estMonPret: false })).toMatchObject({ reparer: true, preter: false });
  });
  it('élément de kit : ni emprunt ni réservation séparés', () => {
    const a = actionsFiche({ objet: objet({ parent_id: 'k1' }), role: 'gestionnaire', prets: [], estMonPret: false });
    expect(a).toMatchObject({ emprunter: false, preter: false, reserver: false, modifier: true });
  });
  it('consommable : stock pour le gestionnaire, pas de prêt ni de réservation', () => {
    const base = { objet: objet({ consommable: true }), prets: [] };
    expect(actionsFiche({ ...base, role: 'gestionnaire', estMonPret: false })).toMatchObject({ ajusterStock: true, emprunter: false, preter: false, reserver: false });
    expect(actionsFiche({ ...base, role: 'emprunteur', estMonPret: false })).toMatchObject({ ajusterStock: false });
  });
  it('sans rôle dans l\'organisation : aucune action', () => {
    const a = actionsFiche({ objet: objet(), role: null, prets: [], estMonPret: false });
    expect(Object.values(a).every((v) => v === false)).toBe(true);
  });
  it('un objet numérique ne se prête, ne se réserve et ne se signale pas, mais se modifie', () => {
    const a = actionsFiche({ objet: objet({ type_ressource: 'numerique' }), role: 'gestionnaire', prets: [], estMonPret: false });
    expect(a).toMatchObject({ emprunter: false, preter: false, rendre: false, prolonger: false, reserver: false, signaler: false, reparer: false, ajusterStock: false, ecrireNfc: false, modifier: true });
  });
  it('un objet « les deux » se prête comme un objet physique', () => {
    const a = actionsFiche({ objet: objet({ type_ressource: 'les_deux' }), role: 'gestionnaire', prets: [], estMonPret: false });
    expect(a).toMatchObject({ preter: true, emprunter: true, reserver: true });
  });
});
