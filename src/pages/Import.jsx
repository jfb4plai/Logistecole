import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import { useCategories, useEmplacements } from '../data/hooks.js';
import { executerImport, lireFichierImport } from '../data/importer.js';
import { analyserImport, MODELE_CSV, MAX_LIGNES_IMPORT, validerFichierImport } from '../domain/import.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

function telechargerModele() {
  const blob = new Blob(['﻿', MODELE_CSV], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'modele-import-logistecole.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Import() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];
  const [fichier, setFichier] = useState(null);
  const [creerManquants, setCreerManquants] = useState(true);
  const [analyse, setAnalyse] = useState(null);
  const [erreur, setErreur] = useState('');
  const [progres, setProgres] = useState(null);
  const [resultat, setResultat] = useState('');
  const [occupe, setOccupe] = useState(false);

  async function analyser() {
    setErreur(''); setResultat(''); setAnalyse(null);
    const v = validerFichierImport(fichier);
    if (!v.ok) { setErreur(v.erreur); return; }
    setOccupe(true);
    try {
      const lignes = await lireFichierImport(fichier);
      setAnalyse(analyserImport(lignes, { categories: cats, emplacements: emps, creerManquants }));
    } catch (e) {
      setErreur('Ce fichier n\'a pas pu être lu. Utilisez un fichier .xlsx ou .csv, avec les en-têtes sur la première ligne.');
    } finally { setOccupe(false); }
  }

  async function importer() {
    setErreur(''); setOccupe(true); setProgres({ faits: 0, total: total });
    try {
      const r = await executerImport({ orgId, analyse, surProgres: (faits, t) => setProgres({ faits, total: t }) });
      await Promise.all([qc.invalidateQueries({ queryKey: ['objets', orgId] }), qc.invalidateQueries({ queryKey: ['categories', orgId] }), qc.invalidateQueries({ queryKey: ['emplacements', orgId] })]);
      setResultat(`${r.crees} objet${r.crees > 1 ? 's' : ''} importé${r.crees > 1 ? 's' : ''}.`);
      setAnalyse(null); setFichier(null);
    } catch (e) {
      setErreur(`${messageErreur(e)}${e?.dejaCrees ? ` ${e.dejaCrees} objet(s) avaient déjà été importés avant l'arrêt : vérifiez la liste avant de relancer.` : ''}`);
    } finally { setOccupe(false); setProgres(null); }
  }

  const total = analyse ? analyse.objets.reduce((s, o) => s + o.quantite, 0) : 0;

  return (
    <section>
      <h2>Importer un inventaire existant</h2>
      <p className="champ-aide">Pour reprendre un tableur sans tout ressaisir. La première ligne contient les noms de colonnes ; seules « nom » et « catégorie » sont obligatoires. {MAX_LIGNES_IMPORT} lignes au maximum par import.</p>
      <div className="actions"><button className="plai-btn-ghost" onClick={telechargerModele}>Télécharger le modèle (CSV)</button></div>

      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {resultat && <p className="plai-success" role="status">{resultat} <Link to="/etiquettes">Imprimer les étiquettes</Link></p>}

      <div className="plai-card">
        <ChampGuide id="fichier-import" label="Fichier à importer" obligatoire aide="Un fichier Excel (.xlsx) ou CSV. Une colonne « quantité » crée plusieurs exemplaires, chacun avec son code. Rien n'est enregistré avant votre confirmation.">
          <input id="fichier-import" aria-describedby="fichier-import-aide" className="plai-input" type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => { setFichier(e.target.files?.[0] ?? null); setAnalyse(null); setResultat(''); }} />
        </ChampGuide>
        <div className="plai-field">
          <label className="liste-cases"><span><input type="checkbox" checked={creerManquants} onChange={(e) => { setCreerManquants(e.target.checked); setAnalyse(null); }} /> Créer les catégories et emplacements qui n'existent pas encore</span></label>
          <p className="champ-aide">Si vous décochez, une ligne dont la catégorie ou l'emplacement est inconnu est refusée.</p>
        </div>
        <button className="plai-btn" disabled={!fichier || occupe} onClick={analyser}>Analyser le fichier</button>
      </div>

      {analyse && (
        <div className="plai-card">
          <h3>Résultat de l'analyse</h3>
          <p><strong>{analyse.objets.length} ligne{analyse.objets.length > 1 ? 's' : ''} valide{analyse.objets.length > 1 ? 's' : ''}</strong>, soit {total} objet{total > 1 ? 's' : ''} à créer.
            {analyse.erreurs.length > 0 && <> {analyse.erreurs.length} ligne{analyse.erreurs.length > 1 ? 's' : ''} en erreur (ignorée{analyse.erreurs.length > 1 ? 's' : ''}).</>}</p>
          {analyse.categoriesManquantes.length > 0 && <p>Catégories à créer : {analyse.categoriesManquantes.join(', ')}.</p>}
          {analyse.emplacementsManquants.length > 0 && <p>Emplacements à créer : {analyse.emplacementsManquants.join(', ')}.</p>}
          {analyse.erreurs.length > 0 && (
            <div className="defile">
              <table className="tableau">
                <thead><tr><th>Ligne</th><th>Problème</th></tr></thead>
                <tbody>{analyse.erreurs.map((e) => <tr key={`${e.ligne}-${e.message}`}><td>{e.ligne || '—'}</td><td>{e.message}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {progres && <p role="status">Import en cours : {progres.faits} sur {progres.total}…</p>}
          <button className="plai-btn" disabled={occupe || analyse.objets.length === 0} onClick={importer}>Importer {total} objet{total > 1 ? 's' : ''}</button>
        </div>
      )}
    </section>
  );
}
