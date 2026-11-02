// Données fictives en mémoire pour le mode démonstration. Les actions modifient ce magasin, sans règle de base :
// c'est un aperçu de l'interface, pas une simulation fidèle de la base.
const jour = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const maintenant = (h = 0) => new Date(Date.now() + h * 3600000).toISOString();

const base = { org_id: 'o1', etat: 'bon', parent_id: null, consommable: false, notes: null, photo_path: null, categorie_id: 'c1', emplacement_id: 'e1',
  liens: [], quantite: null, seuil_min: null, date_achat: null, fournisseur: null, prix_achat: null, garantie_fin: null, numero_serie: null,
  facture_url: null, facture_photo_path: null, financement: null, cree_le: maintenant(-500), maj_le: maintenant(-5) };

export const categories = [
  { id: 'c1', nom: 'Tablettes et ordinateurs' }, { id: 'c2', nom: 'Matériel de sciences' }, { id: 'c3', nom: 'Matériel de sport' }, { id: 'c4', nom: 'Fournitures' },
];
export const emplacements = [{ id: 'e1', nom: 'Salle 12', parent_id: null }, { id: 'e2', nom: 'Armoire A', parent_id: 'e1' }, { id: 'e3', nom: 'Préau', parent_id: null }];

export const objets = [
  { ...base, id: 'K', code: 'KKKK2222', nom: 'Valise de 16 tablettes', notes: 'Chariot de charge inclus. Clé chez la secrétaire.',
    date_achat: '2026-09-15', fournisseur: 'Librairie scolaire de Liège', prix_achat: 4800, garantie_fin: '2028-09-15', financement: 'Budget du Pôle, rentrée 2026', numero_serie: 'SN-4F8K2L19',
    facture_url: 'https://exemple.be/factures/2026-09-15.pdf',
    liens: [{ titre: 'Mode d\'emploi du chariot', url: 'https://exemple.be/notice.pdf' }, { titre: 'Fiche pédagogique : lecture sur tablette', url: 'https://exemple.be/fiche' }] },
  { ...base, id: 'T1', code: 'TTTT2224', nom: 'Tablette 1', parent_id: 'K' },
  { ...base, id: 'T2', code: 'TTTT2225', nom: 'Tablette 2', parent_id: 'K' },
  { ...base, id: 'T3', code: 'TTTT2226', nom: 'Tablette 3', parent_id: 'K', etat: 'defectueux' },
  { ...base, id: 'P', code: 'PPPP2222', nom: 'Projecteur numérique', categorie_id: 'c1', emplacement_id: 'e2', etat: 'use' },
  { ...base, id: 'M', code: 'MMMM2222', nom: 'Microscope binoculaire', categorie_id: 'c2' },
  { ...base, id: 'B', code: 'BBBB2222', nom: 'Ballons de basket (lot de 10)', categorie_id: 'c3', emplacement_id: 'e3' },
  { ...base, id: 'C', code: 'CCCC2222', nom: 'Piles AA', categorie_id: 'c4', consommable: true, quantite: 4, seuil_min: 6 },
  { ...base, id: 'G', code: 'GGGG2222', nom: 'Vieux globe terrestre', categorie_id: 'c2', etat: 'sorti' },
].map((o) => ({ ...o, logi_categories: { nom: categories.find((c) => c.id === o.categorie_id)?.nom }, logi_emplacements: { nom: emplacements.find((e) => e.id === o.emplacement_id)?.nom } }));

export const emprunteurs = [
  { id: 'e-demo', type: 'enseignant', libelle: 'demo@ecole.be', compte_id: 'u-demo' },
  { id: 'e-md', type: 'enseignant', libelle: 'M.D.', compte_id: null },
  { id: 'e-e12', type: 'eleve', libelle: 'E12', compte_id: null },
];
const emp = (id) => emprunteurs.find((e) => e.id === id);
const lien = (id, o, echeance, groupe, empId) => ({ id, org_id: 'o1', objet_id: o, groupe_id: groupe, emprunteur_id: empId, debut: maintenant(-72), echeance, retour_le: null,
  etat_retour: null, commentaire: null, logi_emprunteurs: emp(empId), logi_objets: (() => { const x = objets.find((q) => q.id === o); return { nom: x.nom, code: x.code, parent_id: x.parent_id }; })() });
export const prets = [
  lien('p1', 'K', jour(2), 'g1', 'e-demo'), lien('p2', 'T1', jour(2), 'g1', 'e-demo'), lien('p3', 'T2', jour(2), 'g1', 'e-demo'),
  lien('p4', 'P', jour(-3), 'g2', 'e-md'),
];
export const reservations = [
  { id: 'r1', org_id: 'o1', objet_id: 'M', emprunteur_id: 'e-md', debut: maintenant(30), fin: maintenant(33), statut: 'active',
    logi_emprunteurs: emp('e-md'), logi_objets: { nom: 'Microscope binoculaire', code: 'MMMM2222' } },
];
export const historique = [
  { id: 4, type: 'pret', avant: null, apres: 'demo@ecole.be', commentaire: `jusqu'au ${jour(2).split('-').reverse().join('/')}`, quand: maintenant(-72), auteur_email: 'demo@ecole.be' },
  { id: 3, type: 'deplacement', avant: 'Armoire A', apres: 'Salle 12', commentaire: null, quand: maintenant(-200), auteur_email: 'gestion@ecole.be' },
  { id: 2, type: 'achat', avant: null, apres: '15/09/2026', commentaire: 'Librairie scolaire de Liège', quand: maintenant(-500), auteur_email: 'gestion@ecole.be' },
  { id: 1, type: 'creation', avant: null, apres: 'Valise de 16 tablettes', commentaire: null, quand: maintenant(-500), auteur_email: 'gestion@ecole.be' },
];
export const membres = [
  { user_id: 'u-demo', email: 'demo@ecole.be', role: 'admin', cree_le: maintenant(-900) },
  { user_id: 'u2', email: 'gestion@ecole.be', role: 'gestionnaire', cree_le: maintenant(-800) },
  { user_id: 'u3', email: 'prof.martin@ecole.be', role: 'emprunteur', cree_le: maintenant(-100) },
];
export const jourFutur = jour;
