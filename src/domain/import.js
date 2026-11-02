import { validerAchat } from './achat.js';
import { analyserLiens } from './liens.js';
import { dateIso } from './echeance.js';

export const MAX_LIGNES_IMPORT = 1000;

export const MODELE_CSV = [
  'nom;catégorie;emplacement;quantité;état;notes;date d\'achat;fournisseur;prix;garantie;numéro de série;financement;lien',
  'Valise de 16 tablettes;Tablettes et ordinateurs;Salle 12;1;bon;Chariot de charge inclus;15/09/2026;Fournisseur X;4800,00;15/09/2028;;Budget du Pôle;https://exemple.be/notice',
  'Projecteur;Projection et son;Armoire A;2;bon;;;;;;;;',
  '',
].join('\r\n');

export const normaliserNom = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const COLONNES = {
  nom: ['nom', 'designation', 'objet', 'libelle', 'materiel'],
  categorie: ['categorie', 'type'],
  emplacement: ['emplacement', 'lieu', 'local', 'rangement'],
  quantite: ['quantite', 'nombre', 'nb', 'exemplaires'],
  etat: ['etat'],
  notes: ['notes', 'remarques', 'commentaire', 'commentaires', 'observations'],
  date_achat: ['date d achat', 'date achat', 'achat', 'date'],
  fournisseur: ['fournisseur', 'magasin'],
  prix_achat: ['prix', 'prix d achat', 'prix achat', 'montant'],
  garantie_fin: ['garantie', 'fin de garantie', 'garantie jusqu au', 'fin garantie'],
  numero_serie: ['numero de serie', 'n de serie', 'serie', 'numero serie', 'n serie'],
  financement: ['financement', 'origine', 'origine du financement'],
  lien: ['lien', 'liens', 'url', 'adresse', 'mode d emploi'],
};

const ETATS = { bon: 'bon', 'bon etat': 'bon', use: 'use', defectueux: 'defectueux', perdu: 'perdu' };

const cellule = (v) => (v instanceof Date ? v : String(v ?? '').trim());
const vide = (v) => v === '' || v == null;

// Dates : objet Date (cellule Excel), AAAA-MM-JJ, JJ/MM/AAAA ou numéro de série Excel.
function versIso(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : dateIso(v);
  if (typeof v === 'number') return dateIso(new Date(Date.UTC(1899, 11, 30) + v * 86400000));
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d+$/.test(t)) return versIso(Number(t));
  return null;
}

export function analyserImport(lignes, { categories = [], emplacements = [], creerManquants = false } = {}) {
  const resultat = { objets: [], erreurs: [], categoriesManquantes: [], emplacementsManquants: [] };
  const err = (ligne, message) => resultat.erreurs.push({ ligne, message });
  if (!lignes || lignes.length === 0) { err(0, 'Le fichier est vide.'); return resultat; }

  const entetes = lignes[0].map((h) => normaliserNom(h));
  const index = {};
  for (const [cle, synonymes] of Object.entries(COLONNES)) {
    const i = entetes.findIndex((h) => synonymes.includes(h));
    if (i >= 0) index[cle] = i;
  }
  for (const [cle, nom] of [['nom', 'nom'], ['categorie', 'catégorie']]) {
    if (index[cle] === undefined) { err(1, `Colonne « ${nom} » introuvable dans la première ligne.`); return resultat; }
  }
  const donnees = lignes.slice(1).map((l, i) => ({ l, numero: i + 2 })).filter(({ l }) => l.some((c) => !vide(cellule(c))));
  if (donnees.length === 0) { err(0, 'Le fichier est vide : aucune ligne sous les en-têtes.'); return resultat; }
  if (donnees.length > MAX_LIGNES_IMPORT) { err(0, `Trop de lignes : ${MAX_LIGNES_IMPORT} au maximum par import.`); return resultat; }

  const parNomCat = new Map(categories.map((c) => [normaliserNom(c.nom), c]));
  const parNomEmp = new Map(emplacements.map((e) => [normaliserNom(e.nom), e]));
  const manqCat = new Map();
  const manqEmp = new Map();

  for (const { l, numero } of donnees) {
    const get = (cle) => (index[cle] === undefined ? '' : cellule(l[index[cle]]));
    const erreursLigne = [];

    const nom = String(get('nom')).trim();
    if (!nom) erreursLigne.push('Le nom est obligatoire.');
    else if (nom.length > 120) erreursLigne.push('Le nom dépasse 120 caractères.');

    const catSaisie = String(get('categorie')).trim();
    let categorie = null;
    let categorieId = null;
    if (!catSaisie) erreursLigne.push('La catégorie est obligatoire.');
    else if (parNomCat.has(normaliserNom(catSaisie))) { categorie = parNomCat.get(normaliserNom(catSaisie)).nom; categorieId = parNomCat.get(normaliserNom(catSaisie)).id; }
    else if (creerManquants) { categorie = catSaisie; if (!manqCat.has(normaliserNom(catSaisie))) manqCat.set(normaliserNom(catSaisie), catSaisie); }
    else erreursLigne.push(`Catégorie « ${catSaisie} » inconnue.`);

    const empSaisi = String(get('emplacement')).trim();
    let emplacement = null;
    let emplacementId = null;
    if (empSaisi) {
      if (parNomEmp.has(normaliserNom(empSaisi))) { emplacement = parNomEmp.get(normaliserNom(empSaisi)).nom; emplacementId = parNomEmp.get(normaliserNom(empSaisi)).id; }
      else if (creerManquants) { emplacement = empSaisi; if (!manqEmp.has(normaliserNom(empSaisi))) manqEmp.set(normaliserNom(empSaisi), empSaisi); }
      else erreursLigne.push(`Emplacement « ${empSaisi} » inconnu.`);
    }

    let quantite = 1;
    const q = get('quantite');
    if (!vide(q)) {
      const n = Number(String(q).replace(',', '.'));
      if (!Number.isInteger(n) || n < 1 || n > 100) erreursLigne.push('La quantité doit être un nombre entier entre 1 et 100.');
      else quantite = n;
    }

    let etat = 'bon';
    const e = get('etat');
    if (!vide(e)) {
      etat = ETATS[normaliserNom(e)];
      if (!etat) erreursLigne.push(`État « ${e} » inconnu (bon, usé, défectueux ou perdu).`);
    }

    const brut = {};
    for (const cle of ['date_achat', 'garantie_fin']) {
      const v = get(cle);
      if (vide(v)) { brut[cle] = null; continue; }
      const iso = versIso(v);
      if (!iso) erreursLigne.push(`La date « ${cle === 'date_achat' ? 'd\'achat' : 'de garantie'} » est illisible (JJ/MM/AAAA attendu).`);
      brut[cle] = iso;
    }
    for (const cle of ['prix_achat', 'fournisseur', 'numero_serie', 'financement']) brut[cle] = get(cle);
    const achat = validerAchat({ ...brut, facture_url: null });
    if (!achat.ok) erreursLigne.push(...achat.erreurs);

    let liens = [];
    const lien = String(get('lien')).trim();
    if (lien) {
      const r = analyserLiens(lien);
      liens = r.liens;
      erreursLigne.push(...r.erreurs);
    }

    if (erreursLigne.length) { err(numero, erreursLigne.join(' ')); continue; }
    resultat.objets.push({
      nom, categorie, categorie_id: categorieId, emplacement, emplacement_id: emplacementId,
      quantite, etat, notes: String(get('notes')).trim() || null, ...achat.valeurs, liens,
    });
  }
  resultat.categoriesManquantes = [...manqCat.values()];
  resultat.emplacementsManquants = [...manqEmp.values()];
  return resultat;
}
