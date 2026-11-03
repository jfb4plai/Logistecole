import { pretOuvertDe } from './kit.js';
import { peutEcrire } from './permissions.js';

import { ETATS_PRETABLES as PRETABLE } from './etats.js';
const PEUT_EMPRUNTER = ['admin', 'gestionnaire', 'emprunteur'];

// Quelles actions montrer sur la fiche. La base refuse de toute façon ce qui n'est pas permis.
export function actionsFiche({ objet, role, prets, estMonPret }) {
  const ecrit = peutEcrire(role);
  // Un objet numérique ne se prête pas : seule la modification de la fiche reste possible.
  if (objet.type_ressource === 'numerique') {
    return { emprunter: false, preter: false, rendre: false, prolonger: false, reserver: false, signaler: false, reparer: false, ajusterStock: false, modifier: ecrit, ecrireNfc: false };
  }
  const pret = pretOuvertDe(prets, objet.id);
  const racine = !objet.parent_id && !objet.consommable;
  const libre = racine && !pret && PRETABLE.includes(objet.etat);
  const membre = !!role;
  return {
    emprunter: PEUT_EMPRUNTER.includes(role) && libre,
    preter: ecrit && libre,
    rendre: !!pret && (ecrit || !!estMonPret),
    prolonger: !!pret && (ecrit || !!estMonPret),
    reserver: PEUT_EMPRUNTER.includes(role) && racine && PRETABLE.includes(objet.etat),
    signaler: membre && PRETABLE.includes(objet.etat),
    reparer: ecrit && objet.etat === 'defectueux',
    ajusterStock: ecrit && objet.consommable,
    modifier: ecrit,
    ecrireNfc: ecrit,
  };
}
