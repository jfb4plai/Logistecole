import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import { listerJournal } from '../data/journal.js';
import { CATEGORIES_JOURNAL, TAILLE_PAGE_JOURNAL, filtrerJournal, grouperParJour } from '../domain/journal.js';
import { libelleEvenement } from '../domain/historique.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

const heure = (iso) => new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });

export default function Journal() {
  const { orgId, role } = useOrg();
  const [suite, setSuite] = useState([]); // événements des pages suivantes, déjà chargés
  const [fini, setFini] = useState(false);
  const [categorie, setCategorie] = useState('');
  const [q, setQ] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreurSuite, setErreurSuite] = useState(null);
  const premiere = useQuery({ queryKey: ['journal', orgId], enabled: !!orgId && role !== 'emprunteur', queryFn: () => listerJournal(orgId) });

  if (role === 'emprunteur') {
    return <div className="plai-card"><h1>Journal</h1><p>Le journal de l'organisation est réservé aux gestionnaires. Vos prêts sont dans <Link to="/emprunts">Mes emprunts</Link>.</p></div>;
  }

  const tous = [...(premiere.data ?? []), ...suite];
  const dernier = tous[tous.length - 1];
  const pleine = tous.length > 0 && tous.length % TAILLE_PAGE_JOURNAL === 0 && !fini;
  const jours = grouperParJour(filtrerJournal(tous, { categorie, q }));
  const erreur = premiere.error ?? erreurSuite;

  async function chargerPlus() {
    setErreurSuite(null); setChargement(true);
    try {
      const page = await listerJournal(orgId, dernier.id);
      setSuite((s) => [...s, ...page]);
      if (page.length < TAILLE_PAGE_JOURNAL) setFini(true);
    } catch (e) { setErreurSuite(e); } finally { setChargement(false); }
  }

  return (
    <>
      <h1>Journal</h1>
      <p className="accroche">Tout ce qui s'est passé dans l'organisation, du plus récent au plus ancien : qui a fait quoi, sur quel objet, quand. Le journal ne se modifie jamais.</p>
      <div className="filtres">
        <ChampGuide id="journal-categorie" label="Catégorie" aide="Limite la liste à un type d'événement.">
          <select id="journal-categorie" aria-describedby="journal-categorie-aide" className="plai-input" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {CATEGORIES_JOURNAL.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </ChampGuide>
        <ChampGuide id="journal-q" label="Rechercher" aide="Un objet, un code, une personne, un mot du commentaire.">
          <input id="journal-q" aria-describedby="journal-q-aide" type="search" className="plai-input" placeholder="Ex. : projecteur, M.D., écran" value={q} onChange={(e) => setQ(e.target.value)} />
        </ChampGuide>
      </div>
      {erreur && <p className="plai-error" role="alert">{messageErreur(erreur)}</p>}
      {premiere.isLoading && <p className="chargement">Chargement…</p>}
      {!premiere.isLoading && !premiere.error && jours.length === 0 && <p className="plai-empty">Aucun événement ne correspond.</p>}
      {jours.map((j) => (
        <section key={j.jour}>
          <h2>{j.libelle}</h2>
          <ul className="journal">
            {j.evenements.map((e) => (
              <li key={e.id}>
                <span className="journal-heure">{heure(e.quand)}</span>
                <span className="journal-texte">
                  {e.logi_objets?.code ? <Link to={`/o/${e.logi_objets.code}`}>{e.logi_objets.nom}</Link> : <strong>{e.logi_objets?.nom ?? 'Objet supprimé'}</strong>}
                  {' : '}{libelleEvenement(e)}
                  {e.auteur_email && <span className="auteur">par {e.auteur_email}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {pleine && (
        <div className="actions">
          <button className="plai-btn-ghost" disabled={chargement} onClick={chargerPlus}>{chargement ? 'Chargement…' : 'Charger plus d’événements'}</button>
        </div>
      )}
    </>
  );
}
