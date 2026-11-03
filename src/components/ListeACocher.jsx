import { useState } from 'react';

// Liste déroulante à cocher (pas de select multiple natif : illisible sur téléphone).
// « Autre (préciser) » ouvre un champ de description, obligatoire dès que la case est cochée.
export default function ListeACocher({
  id, label, aide, options, valeurs, onChange, autre, onAutre, sansAutre = false,
  placeholderAutre = 'Ex. : élèves allophones en début d\'apprentissage du français',
  aideAutre = 'Décrivez en une phrase. Ce texte reste sur la fiche et se retrouve en recherche libre.',
}) {
  const [ouvert, setOuvert] = useState(false);
  const noms = [...options.filter((o) => valeurs.includes(o.value)).map((o) => o.label), ...(autre?.coche && !sansAutre ? ['Autre'] : [])];
  const resume = noms.length === 0 ? 'Choisir…' : `${noms.join(', ')} (${noms.length} coché${noms.length > 1 ? 's' : ''})`;
  const basculer = (v) => onChange(valeurs.includes(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v]);

  return (
    <div className="plai-field">
      <span id={`${id}-label`} className="plai-label">{label}</span>
      <button
        type="button" className="plai-input liste-deroulante-bouton"
        aria-expanded={ouvert} aria-controls={`${id}-panneau`} aria-labelledby={`${id}-label ${id}-resume`}
        onClick={() => setOuvert(!ouvert)}
      >
        <span id={`${id}-resume`}>{resume}</span> <span aria-hidden="true">{ouvert ? '▴' : '▾'}</span>
      </button>
      <p className="champ-aide">{aide}</p>
      {ouvert && (
        <div id={`${id}-panneau`} className="liste-deroulante" role="group" aria-labelledby={`${id}-label`}>
          {options.map((o) => (
            <div key={o.value} className="case-44">
              <input id={`${id}-${o.value}`} type="checkbox" checked={valeurs.includes(o.value)} onChange={() => basculer(o.value)}
                aria-describedby={o.aide ? `${id}-${o.value}-aide` : undefined} />
              <label htmlFor={`${id}-${o.value}`}>{o.label}</label>
              {o.aide && <p id={`${id}-${o.value}-aide`} className="champ-aide case-aide">{o.aide}</p>}
            </div>
          ))}
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
        </div>
      )}
    </div>
  );
}
