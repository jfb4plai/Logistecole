import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets } from '../data/hooks.js';
import { filtrerObjets } from '../domain/filtres.js';
import { formaterCode } from '../domain/codes.js';
import { messageErreur } from '../lib/erreurs.js';
import { genererPdfEtiquettes } from '../domain/etiquettes.js';
import ChampGuide from '../components/ChampGuide.jsx';

export default function Etiquettes() {
  const { orgId, orgNom } = useOrg();
  const [params] = useSearchParams();
  const objetsQ = useObjets(orgId);
  const [q, setQ] = useState('');
  const [choix, setChoix] = useState(new Set());
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const demandes = useMemo(() => (params.get('codes') ?? '').split(',').filter(Boolean), [params]);
  useEffect(() => {
    if (objetsQ.data && demandes.length) {
      setChoix(new Set(objetsQ.data.filter((o) => demandes.includes(o.code)).map((o) => o.id)));
    }
  }, [objetsQ.data, demandes]);

  const visibles = filtrerObjets(objetsQ.data ?? [], { q });
  const basculer = (id) => setChoix((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function generer() {
    setErreur('');
    setEnvoi(true);
    try {
      const objets = (objetsQ.data ?? []).filter((o) => choix.has(o.id));
      const doc = await genererPdfEtiquettes(objets, orgNom, window.location.origin);
      doc.save('etiquettes-logistecole.pdf');
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <h1>Étiquettes à imprimer</h1>
      <p className="accroche">Une planche A4 contient 24 étiquettes. Imprimez sur papier autocollant ou sur papier ordinaire, à 100 % (sans « ajuster à la page »).</p>
      <ChampGuide id="q" label="Rechercher dans le matériel" aide="Filtre la liste ci-dessous. Votre sélection est conservée quand vous cherchez autre chose.">
        <input id="q" aria-describedby="q-aide" type="search" className="plai-input" placeholder="Ex. : tablette" value={q} onChange={(e) => setQ(e.target.value)} />
      </ChampGuide>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="plai-btn" disabled={choix.size === 0 || envoi} onClick={generer}>
          {envoi ? 'Création du PDF…' : `Générer le PDF (${choix.size} étiquette${choix.size > 1 ? 's' : ''})`}
        </button>
        <button className="plai-btn-ghost" onClick={() => setChoix(new Set(visibles.map((o) => o.id)))}>Tout sélectionner ({visibles.length})</button>
        <button className="plai-btn-ghost" onClick={() => setChoix(new Set())}>Tout désélectionner</button>
      </div>
      <p className="champ-aide">Les caractères que la police du PDF ne sait pas dessiner (emoji, « œ ») apparaissent sous la forme « ? » sur l'étiquette. Les noms trop longs sont raccourcis.</p>
      {objetsQ.isLoading && <p className="chargement">Chargement…</p>}
      <ul className="liste-cases">
        {visibles.map((o) => (
          <li key={o.id}>
            <label>
              <input type="checkbox" checked={choix.has(o.id)} onChange={() => basculer(o.id)} />
              <span>{o.nom} <span className="code-court">{formaterCode(o.code)}</span></span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
