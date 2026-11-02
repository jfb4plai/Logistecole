import { describe, it, expect } from 'vitest';
import { lireCsv, decoderTexte } from '../../src/domain/csv.js';
import { analyserImport, MODELE_CSV, validerFichierImport } from '../../src/domain/import.js';

describe('lireCsv', () => {
  it('lit le point-virgule d\'Excel en français, les guillemets et le BOM', () => {
    const t = '﻿nom;catégorie;notes\r\n"Valise; de tablettes";Tablettes;"16 iPad ""neufs"""\r\n';
    expect(lireCsv(t)).toEqual([['nom', 'catégorie', 'notes'], ['Valise; de tablettes', 'Tablettes', '16 iPad "neufs"']]);
  });
  it('lit aussi la virgule', () => {
    expect(lireCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('ignore les lignes entièrement vides', () => {
    expect(lireCsv('a;b\n\n;\n1;2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('validerFichierImport', () => {
  it('accepte .xlsx et .csv de taille raisonnable', () => {
    expect(validerFichierImport({ name: 'inventaire.xlsx', size: 120000 }).ok).toBe(true);
    expect(validerFichierImport({ name: 'INVENTAIRE.CSV', size: 800 }).ok).toBe(true);
  });
  it('refuse un ancien .xls en expliquant quoi faire', () => {
    const r = validerFichierImport({ name: 'inventaire.xls', size: 1000 });
    expect(r.ok).toBe(false);
    expect(r.erreur).toMatch(/\.xlsx/);
  });
  it('refuse les autres types, les fichiers vides et ceux de plus de 5 Mo', () => {
    expect(validerFichierImport({ name: 'photo.pdf', size: 1000 }).ok).toBe(false);
    expect(validerFichierImport({ name: 'vide.csv', size: 0 }).ok).toBe(false);
    expect(validerFichierImport({ name: 'gros.xlsx', size: 5 * 1024 * 1024 + 1 }).ok).toBe(false);
    expect(validerFichierImport(null).ok).toBe(false);
  });
});

describe('decoderTexte', () => {
  it('lit de l\'UTF-8', () => {
    expect(decoderTexte(new TextEncoder().encode('Matériel d\'éveil').buffer)).toBe('Matériel d\'éveil');
  });
  it('retombe sur Windows-1252 quand Excel enregistre en ANSI', () => {
    // « é » = 0xE9 en Windows-1252, séquence invalide en UTF-8
    const octets = new Uint8Array([0x4d, 0x61, 0x74, 0xe9, 0x72, 0x69, 0x65, 0x6c]);
    expect(decoderTexte(octets.buffer)).toBe('Matériel');
  });
});

const categories = [{ id: 'c1', nom: 'Tablettes et ordinateurs' }, { id: 'c2', nom: 'Matériel de sciences' }];
const emplacements = [{ id: 'e1', nom: 'Salle 12' }];

describe('analyserImport', () => {
  it('reconnaît les en-têtes avec accents, casse et synonymes', () => {
    const r = analyserImport(
      [['Désignation', 'Catégorie', 'Lieu', 'Nombre', 'État', 'Prix d\'achat', 'Date d\'achat'],
       ['Tablette', 'tablettes et ordinateurs', 'salle 12', '3', 'Usé', '299,00', '15/09/2026']],
      { categories, emplacements });
    expect(r.erreurs).toEqual([]);
    expect(r.objets).toHaveLength(1);
    expect(r.objets[0]).toMatchObject({ nom: 'Tablette', categorie_id: 'c1', emplacement_id: 'e1', quantite: 3, etat: 'use', prix_achat: 299, date_achat: '2026-09-15' });
  });
  it('quantité 1 et état « bon » par défaut', () => {
    const r = analyserImport([['nom', 'catégorie'], ['Loupe', 'Matériel de sciences']], { categories, emplacements });
    expect(r.objets[0]).toMatchObject({ quantite: 1, etat: 'bon', emplacement_id: null });
  });
  it('signale chaque ligne fautive avec son numéro, sans bloquer les autres', () => {
    const r = analyserImport(
      [['nom', 'catégorie', 'quantité', 'état'],
       ['', 'Matériel de sciences', '1', ''],
       ['Loupe', 'Inconnue', '1', ''],
       ['Microscope', 'Matériel de sciences', '500', ''],
       ['Boussole', 'Matériel de sciences', '2', 'cassé'],
       ['Balance', 'Matériel de sciences', '2', '']],
      { categories, emplacements });
    expect(r.objets.map((o) => o.nom)).toEqual(['Balance']);
    expect(r.erreurs.map((e) => e.ligne)).toEqual([2, 3, 4, 5]);
    expect(r.erreurs[0].message).toMatch(/nom/i);
    expect(r.erreurs[1].message).toMatch(/catégorie/i);
    expect(r.erreurs[2].message).toMatch(/100/);
    expect(r.erreurs[3].message).toMatch(/état/i);
  });
  it('propose de créer les catégories et emplacements manquants quand on l\'autorise', () => {
    const r = analyserImport(
      [['nom', 'catégorie', 'emplacement'], ['Casque', 'Audio', 'Armoire B']],
      { categories, emplacements, creerManquants: true });
    expect(r.erreurs).toEqual([]);
    expect(r.categoriesManquantes).toEqual(['Audio']);
    expect(r.emplacementsManquants).toEqual(['Armoire B']);
    expect(r.objets[0]).toMatchObject({ categorie: 'Audio', categorie_id: null, emplacement: 'Armoire B', emplacement_id: null });
  });
  it('refuse un fichier sans colonne « nom » ou sans ligne', () => {
    expect(analyserImport([['catégorie'], ['x']], { categories, emplacements }).erreurs[0].message).toMatch(/colonne/i);
    expect(analyserImport([], { categories, emplacements }).erreurs[0].message).toMatch(/vide/i);
  });
  it('limite à 1000 lignes', () => {
    const lignes = [['nom', 'catégorie'], ...Array.from({ length: 1001 }, (_, i) => [`Objet ${i}`, 'Matériel de sciences'])];
    expect(analyserImport(lignes, { categories, emplacements }).erreurs[0].message).toMatch(/1000/);
  });
  it('lit des dates déjà converties en objets Date (cellules Excel)', () => {
    const r = analyserImport([['nom', 'catégorie', 'date d\'achat'], ['Loupe', 'Matériel de sciences', new Date('2026-09-15T00:00:00')]], { categories, emplacements });
    expect(r.objets[0].date_achat).toBe('2026-09-15');
  });
  it('fournit un modèle CSV lisible par l\'analyse', () => {
    const lignes = lireCsv(MODELE_CSV);
    const r = analyserImport(lignes, { categories: [{ id: 'c1', nom: 'Tablettes et ordinateurs' }], emplacements, creerManquants: true });
    expect(r.erreurs).toEqual([]);
    expect(r.objets.length).toBeGreaterThan(0);
  });
});
