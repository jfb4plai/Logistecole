import { validerAchat } from './achat.js';
import { analyserLiens } from './liens.js';
import { dateIso } from './echeance.js';
import { normaliserIsbn } from './isbn.js';

export const MAX_LIGNES_IMPORT = 1000;

export const MODELE_CSV = [
  'nom;catégorie;emplacement;quantité;état;notes;date d\'achat;fournisseur;prix;garantie;numéro de série;financement;lien;auteur;éditeur;isbn;description;support',
  'Valise de 16 tablettes;Tablettes et ordinateurs;Salle 12;1;bon;Chariot de charge inclus;15/09/2026;Fournisseur X;4800,00;15/09/2028;;Budget du Pôle;https://exemple.be/notice;;;;;physique',
  'Projecteur;Projection et son;Armoire A;2;bon;;;;;;;;;;;;',
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
  auteur: ['auteur', 'auteurs'],
  editeur: ['editeur', 'editeurs', 'maison d edition'],
  isbn: ['isbn', 'isbn13', 'isbn 13', 'isbn10', 'isbn 10'],
  description: ['description', 'resume', 'descriptif'],
  support: ['support', 'physique ou numerique', 'type de ressource'],
};

const SUPPORTS = { physique: 'physique', numerique: 'numerique', 'les deux': 'les_deux', 'physique et numerique': 'les_deux' };

const ETATS = { neuf: 'neuf', bon: 'bon', 'bon etat': 'bon', use: 'use', defectueux: 'defectueux', perdu: 'perdu' };

const cellule = (v) => (v instanceof Date ? v : String(v ?? '').trim());
const vide = (v) => v === '' || v == null;

// Dates : objet Date (cellule Excel), AAAA-MM-JJ, JJ/MM/AAAA ou numéro de série Excel.
function versIso(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // Les cellules Excel arrivent en minuit UTC : on lit alors la date UTC, sinon la date locale.
    const minuitUtc = v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0;
    return minuitUtc ? v.toISOString().slice(0, 10) : dateIso(v);
  }
  if (typeof v === 'number') return dateIso(new Date(Date.UTC(1899, 11, 30) + v * 86400000));
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return jourExiste(+t.slice(0, 4), +t.slice(5, 7), +t.slice(8, 10)) ? t : null;
  // JJ/MM/AAAA, JJ-MM-AA, JJ.MM.AA… (Excel réécrit un CSV avec l'année sur 2 chiffres), heure à minuit tolérée.
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:[ T]00:00(?::00)?)?$/);
  if (m) {
    const annee = m[3].length === 2 ? (+m[3] < 70 ? 2000 : 1900) + +m[3] : +m[3];
    return jourExiste(annee, +m[2], +m[1])
      ? `${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  }
  if (/^\d+$/.test(t)) return versIso(Number(t));
  return null;
}

// Refuse 31/02 au lieu de le décaler au 3 mars.
function jourExiste(a, m, j) {
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
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
      if (!etat) erreursLigne.push(`État « ${e} » inconnu (neuf, bon, usé, défectueux ou perdu).`);
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

    const auteur = String(get('auteur')).trim();
    const editeur = String(get('editeur')).trim();
    if (auteur.length > 200) erreursLigne.push('L\'auteur dépasse 200 caractères.');
    if (editeur.length > 200) erreursLigne.push('L\'éditeur dépasse 200 caractères.');
    const description = String(get('description')).trim();
    if (description.length > 2000) erreursLigne.push('La description dépasse 2000 caractères.');
    const isbnSaisi = String(get('isbn')).trim();
    const isbn = isbnSaisi ? normaliserIsbn(isbnSaisi) : null;
    if (isbnSaisi && !isbn) erreursLigne.push(`L'ISBN « ${isbnSaisi} » n'est pas valide (10 ou 13 chiffres, clé de contrôle correcte).`);
    let typeRessource = 'physique';
    const support = get('support');
    if (!vide(support)) {
      typeRessource = SUPPORTS[normaliserNom(support)];
      if (!typeRessource) { erreursLigne.push(`Support « ${support} » inconnu (physique, numérique ou les deux).`); typeRessource = 'physique'; }
    }
    if (typeRessource === 'numerique' && quantite > 1) erreursLigne.push('Un objet numérique ne s\'importe qu\'en un seul exemplaire.');

    if (erreursLigne.length) { err(numero, erreursLigne.join(' ')); continue; }
    resultat.objets.push({
      nom, categorie, categorie_id: categorieId, emplacement, emplacement_id: emplacementId,
      quantite, etat, notes: String(get('notes')).trim() || null, ...achat.valeurs, liens,
      auteur: auteur || null, editeur: editeur || null, isbn, description: description || null, type_ressource: typeRessource,
    });
  }
  resultat.categoriesManquantes = [...manqCat.values()];
  resultat.emplacementsManquants = [...manqEmp.values()];
  return resultat;
}

export const TAILLE_MAX_IMPORT = 5 * 1024 * 1024;

// Contrôle avant lecture : un fichier énorme ou d'un mauvais format ne doit pas figer le navigateur.
export function validerFichierImport(fichier) {
  if (!fichier || !fichier.size) return { ok: false, erreur: 'Aucun fichier, ou fichier vide.' };
  const nom = String(fichier.name ?? '').toLowerCase();
  if (nom.endsWith('.xls')) return { ok: false, erreur: 'L\'ancien format .xls n\'est pas lu : enregistrez le fichier en .xlsx ou en CSV depuis Excel.' };
  if (!nom.endsWith('.xlsx') && !nom.endsWith('.csv')) return { ok: false, erreur: 'Le fichier doit être un .xlsx ou un .csv.' };
  if (fichier.size > TAILLE_MAX_IMPORT) return { ok: false, erreur: 'Ce fichier dépasse 5 Mo : découpez-le en plusieurs fichiers.' };
  return { ok: true };
}
