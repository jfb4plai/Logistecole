import { Link } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets } from '../data/hooks.js';
import { messageErreur } from '../lib/erreurs.js';

const FAMILLES = [
  ['autre_trouble', 'Troubles'],
  ['autre_difficulte', 'Difficultés d\'apprentissage'],
  ['autre_amenagement', 'Aménagements'],
];

// Textes saisis dans « Autre (préciser) », par famille : de quoi décider d'ajouter une vraie case à une liste.
export default function AdminAutres() {
  const { orgId } = useOrg();
  const objetsQ = useObjets(orgId);
  const objets = objetsQ.data ?? [];
  const groupes = FAMILLES
    .map(([colonne, titre]) => ({ colonne, titre, lignes: objets.filter((o) => o[colonne]) }))
    .filter((g) => g.lignes.length > 0);

  return (
    <section>
      <h2>Textes « Autre »</h2>
      <p className="champ-aide">
        Ce que les équipes ont écrit quand une liste ne contenait pas la bonne case. Si le même texte revient souvent, il mérite une vraie case :
        l'ajout se fait par une migration de la base, pas depuis cet écran.
      </p>
      {objetsQ.isLoading && <p className="chargement">Chargement…</p>}
      {objetsQ.error && <p className="plai-error" role="alert">{messageErreur(objetsQ.error)}</p>}
      {!objetsQ.isLoading && !objetsQ.error && groupes.length === 0 && <p className="plai-empty">Aucun texte « Autre » pour l'instant.</p>}
      {groupes.map((g) => (
        <div key={g.colonne}>
          <h3>{g.titre}</h3>
          <ul className="liste-simple">
            {g.lignes.map((o) => (
              <li key={o.id}><Link to={`/o/${o.code}`}>{o.nom}</Link> : <span>{o[g.colonne]}</span></li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
