import { useState } from 'react';
import { useOrg } from '../lib/org.jsx';
import { estAdmin } from '../domain/permissions.js';
import AdminReferentiel from './AdminReferentiel.jsx';
import AdminMembres from './AdminMembres.jsx';

export default function Admin() {
  const { role } = useOrg();
  const [onglet, setOnglet] = useState('emplacements');
  if (!estAdmin(role)) return <p className="plai-error" role="alert">Cette page est réservée aux administrateurs de l'organisation.</p>;
  return (
    <>
      <h1>Administration</h1>
      <div className="onglets-admin" role="tablist">
        {[['emplacements', 'Emplacements'], ['categories', 'Catégories'], ['membres', 'Membres']].map(([id, nom]) => (
          <button key={id} role="tab" aria-selected={onglet === id} className={onglet === id ? 'plai-btn' : 'plai-btn-ghost'} onClick={() => setOnglet(id)}>{nom}</button>
        ))}
      </div>
      {onglet === 'emplacements' && (
        <AdminReferentiel
          table="logi_emplacements" avecParent titre="Emplacements"
          placeholder="Ex. : Armoire A, salle 12"
          aide="Là où le matériel est rangé. Choisissez un emplacement parent pour faire une arborescence (bâtiment > local > armoire). Un emplacement encore utilisé par du matériel ne peut pas être supprimé."
        />
      )}
      {onglet === 'categories' && (
        <AdminReferentiel
          table="logi_categories" titre="Catégories"
          placeholder="Ex. : Matériel de sciences"
          aide="Servent à classer et filtrer le matériel. Une catégorie encore utilisée ne peut pas être supprimée."
        />
      )}
      {onglet === 'membres' && <AdminMembres />}
    </>
  );
}
