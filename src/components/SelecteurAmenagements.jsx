import { useState } from 'react';
import { basculerChapitre, basculerAmenagement, resumeChapitre } from '../domain/amenagements.js';

// Chapitres du catalogue AménagActif : chaque chapitre se coche en entier ou se déplie pour choisir des aménagements précis.
export default function SelecteurAmenagements({
  id, label, aide, catalogue, selection, onChange, autre, onAutre, sansAutre = false,
  placeholderAutre = 'Ex. : lecteur d\'écran à installer sur la tablette',
  aideAutre = 'Décrivez l\'aménagement. Ce texte reste sur la fiche et se retrouve en recherche libre.',
}) {
  const [ouverts, setOuverts] = useState([]);
  const [voirAU, setVoirAU] = useState(true);
  const [voirAR, setVoirAR] = useState(true);
  const visible = (item) => (item.etiquette === 'Dispositif' ? voirAU || voirAR : item.etiquette === 'AU' ? voirAU : voirAR);
  const basculerOuvert = (cid) => setOuverts(ouverts.includes(cid) ? ouverts.filter((x) => x !== cid) : [...ouverts, cid]);

  return (
    <fieldset className="plai-field selecteur-amenagements">
      <legend className="plai-label">{label}</legend>
      <p className="champ-aide">{aide}</p>
      <div className="case-ligne">
        <div className="case-44">
          <input id={`${id}-au`} type="checkbox" checked={voirAU} onChange={(e) => setVoirAU(e.target.checked)} />
          <label htmlFor={`${id}-au`}><strong>AU</strong> : universels (toute la classe)</label>
        </div>
        <div className="case-44">
          <input id={`${id}-ar`} type="checkbox" checked={voirAR} onChange={(e) => setVoirAR(e.target.checked)} />
          <label htmlFor={`${id}-ar`}><strong>AR</strong> : raisonnables (propres à un élève)</label>
        </div>
      </div>
      <ul className="liste-chapitres">
        {catalogue.map((c) => {
          const r = resumeChapitre(selection, c);
          const ouvert = ouverts.includes(c.id);
          return (
            <li key={c.id} className="chapitre-ligne">
              <div className="case-44">
                <input id={`${id}-ch-${c.id}`} type="checkbox" checked={r.entier} onChange={() => onChange(basculerChapitre(selection, c))} />
                <label htmlFor={`${id}-ch-${c.id}`}><strong>{c.titre}</strong></label>
                {r.entier ? <span className="champ-aide">chapitre entier</span> : r.choisis > 0 && <span className="champ-aide">{r.choisis} sur {r.total}</span>}
                <button type="button" className="plai-btn-ghost" aria-expanded={ouvert} aria-controls={`${id}-detail-${c.id}`}
                  onClick={() => basculerOuvert(c.id)}>
                  {ouvert ? 'Masquer le détail' : 'Voir le détail'}
                </button>
              </div>
              {ouvert && (
                <ul id={`${id}-detail-${c.id}`} className="liste-detail">
                  {c.items.filter(visible).map((item) => (
                    <li key={item.id} className="case-44">
                      <input id={`${id}-am-${item.id}`} type="checkbox" checked={r.entier || selection.amenagements.includes(item.id)} disabled={r.entier}
                        onChange={() => onChange(basculerAmenagement(selection, c, item.id))} />
                      <label htmlFor={`${id}-am-${item.id}`}>
                        <span className={`etiquette etiquette-${item.etiquette.toLowerCase()}`}>{item.etiquette}</span> {item.libelle}
                        {item.desactive && <em> (désactivé dans AménagActif)</em>}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {!sansAutre && (
        <>
          <div className="case-44">
            <input id={`${id}-autre`} type="checkbox" checked={!!autre?.coche} onChange={(e) => onAutre({ ...autre, coche: e.target.checked })} />
            <label htmlFor={`${id}-autre`}>Autre (préciser)</label>
          </div>
          {autre?.coche && (
            <div className="plai-field">
              <label htmlFor={`${id}-autre-texte`} className="plai-label">Précisez « Autre » ({label}) *</label>
              <input id={`${id}-autre-texte`} aria-describedby={`${id}-autre-aide`} className="plai-input" maxLength={500}
                placeholder={placeholderAutre} value={autre.texte} onChange={(e) => onAutre({ ...autre, texte: e.target.value })} />
              <p id={`${id}-autre-aide`} className="champ-aide">{aideAutre}</p>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
