import { creerObjets } from './objets.js';
import { ajouterReferentiel, listerReferentiel } from './referentiels.js';
import { genererCodes } from '../domain/codes.js';
import { normaliserNom } from '../domain/import.js';
import { decoderTexte, lireCsv } from '../domain/csv.js';

// Lit un .xlsx (première feuille) ou un .csv (UTF-8 ou Windows-1252) et renvoie des lignes.
export async function lireFichierImport(fichier) {
  if (/\.csv$/i.test(fichier.name) || fichier.type === 'text/csv') {
    return lireCsv(decoderTexte(await fichier.arrayBuffer()));
  }
  const { readSheet } = await import('read-excel-file/browser');
  return readSheet(fichier);
}

async function creerSiAbsent(table, orgId, nom) {
  try { await ajouterReferentiel(table, orgId, nom); } catch (e) { if (e?.code !== '23505') throw e; }
}

// Crée les catégories et emplacements manquants, puis les objets (quantités développées), par paquets de 100.
export async function executerImport({ orgId, analyse, surProgres }) {
  for (const nom of analyse.categoriesManquantes) await creerSiAbsent('logi_categories', orgId, nom);
  for (const nom of analyse.emplacementsManquants) await creerSiAbsent('logi_emplacements', orgId, nom);
  const cats = new Map((await listerReferentiel('logi_categories', orgId)).map((c) => [normaliserNom(c.nom), c.id]));
  const emps = new Map((await listerReferentiel('logi_emplacements', orgId)).map((e) => [normaliserNom(e.nom), e.id]));

  const lignes = [];
  for (const o of analyse.objets) {
    const { quantite, categorie, emplacement, categorie_id, emplacement_id, ...champs } = o;
    for (let i = 0; i < quantite; i++) {
      lignes.push({
        ...champs,
        categorie_id: categorie_id ?? cats.get(normaliserNom(categorie)),
        emplacement_id: emplacement_id ?? (emplacement ? emps.get(normaliserNom(emplacement)) ?? null : null),
      });
    }
  }
  const codes = genererCodes(lignes.length);
  let faits = 0;
  for (let debut = 0; debut < lignes.length; debut += 100) {
    const paquet = lignes.slice(debut, debut + 100);
    let lot = paquet.map((l, i) => ({ ...l, code: codes[debut + i] }));
    for (let essai = 0; ; essai++) {
      try { await creerObjets(orgId, lot); break; } catch (err) {
        if (err?.code !== '23505' || essai >= 2) throw Object.assign(err, { dejaCrees: faits });
        const nouveaux = genererCodes(lot.length, new Set(codes));
        lot = lot.map((l, i) => ({ ...l, code: nouveaux[i] }));
      }
    }
    faits += paquet.length;
    surProgres?.(faits, lignes.length);
  }
  return { crees: faits };
}
