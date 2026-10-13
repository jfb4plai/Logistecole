import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import { listerReferentiel, ajouterReferentiel, renommerReferentiel, supprimerReferentiel } from '../data/referentiels.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

export default function AdminReferentiel({ table, titre, placeholder, aide, avecParent = false }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const cle = table === 'logi_emplacements' ? 'emplacements' : 'categories';
  const q = useQuery({ queryKey: [cle, orgId], queryFn: () => listerReferentiel(table, orgId) });
  const [nom, setNom] = useState('');
  const [parent, setParent] = useState('');
  const [erreur, setErreur] = useState('');

  const elements = q.data ?? [];
  const parNom = Object.fromEntries(elements.map((e) => [e.id, e]));
  const chemin = (e) => (e.parent_id && parNom[e.parent_id] ? `${chemin(parNom[e.parent_id])} › ${e.nom}` : e.nom);
  const tries = [...elements].sort((a, b) => chemin(a).localeCompare(chemin(b), 'fr'));

  async function agir(fn) {
    setErreur('');
    try { await fn(); qc.invalidateQueries({ queryKey: [cle, orgId] }); } catch (e) { setErreur(messageErreur(e)); }
  }

  return (
    <section>
      <h2>{titre}</h2>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      <form className="plai-card" onSubmit={(e) => { e.preventDefault(); if (!nom.trim()) return; agir(async () => { await ajouterReferentiel(table, orgId, nom, parent); setNom(''); }); }}>
        <ChampGuide id="nouveau-nom" label="Nouveau nom" aide={aide}>
          <input id="nouveau-nom" aria-describedby="nouveau-nom-aide" className="plai-input" maxLength={120} placeholder={placeholder} value={nom} onChange={(e) => setNom(e.target.value)} />
        </ChampGuide>
        {avecParent && (
          <ChampGuide id="parent" label="Emplacement parent" aide="Facultatif. Laissez vide pour un emplacement de premier niveau.">
            <select id="parent" aria-describedby="parent-aide" className="plai-input" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Aucun (premier niveau)</option>
              {tries.map((e) => <option key={e.id} value={e.id}>{chemin(e)}</option>)}
            </select>
          </ChampGuide>
        )}
        <button className="plai-btn" disabled={!nom.trim()}>Ajouter</button>
      </form>
      {q.isLoading && <p className="chargement">Chargement…</p>}
      <table className="tableau">
        <tbody>
          {tries.map((e) => (
            <tr key={e.id}>
              <td>{chemin(e)}</td>
              <td>
                <button className="plai-btn-ghost" onClick={() => {
                  const n = window.prompt('Nouveau nom :', e.nom);
                  if (n && n.trim() && n.trim() !== e.nom) agir(() => renommerReferentiel(table, e.id, n));
                }}>Renommer</button>{' '}
                <button className="plai-btn-ghost" onClick={() => { if (window.confirm(`Supprimer « ${e.nom} » ?`)) agir(() => supprimerReferentiel(table, e.id)); }}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
