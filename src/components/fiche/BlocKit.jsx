import { Link } from 'react-router-dom';
import { elementsDuKit } from '../../domain/kit.js';
import { formaterCode } from '../../domain/codes.js';
import EtatBadge from '../EtatBadge.jsx';

export default function BlocKit({ objet, objets }) {
  const parent = objet.parent_id ? objets.find((o) => o.id === objet.parent_id) : null;
  const elements = elementsDuKit(objets, objet.id);
  if (!parent && elements.length === 0) return null;
  return (
    <section className="plai-card bloc">
      <h2>Kit</h2>
      {parent && <p>Fait partie du kit <Link to={`/o/${parent.code}`}>{parent.nom}</Link>. Il se prête et se rend avec le kit.</p>}
      {elements.length > 0 && (
        <>
          <p>Ce kit contient {elements.length} élément{elements.length > 1 ? 's' : ''} :</p>
          <ul className="liste-objets">
            {elements.map((e) => (
              <li key={e.id}>
                <Link to={`/o/${e.code}`} className="ligne-objet">
                  <span className="ligne-texte"><strong>{e.nom}</strong><span className="meta code-court">{formaterCode(e.code)}</span></span>
                  <EtatBadge etat={e.etat} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
