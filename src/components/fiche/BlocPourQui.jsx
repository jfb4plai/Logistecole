import { Fragment } from 'react';
import { MENTION_INDICATIVE } from '../../domain/criteres.js';

// Critères « Pour qui ? » d'un objet, en lecture seule. `catalogue` vient de organiserCatalogue (avec les aménagements
// déjà liés, même désactivés dans AménagActif). `criteres` : liste de logi_criteres.
export default function BlocPourQui({ objet, criteres = [], catalogue = [] }) {
  const ids = objet.critere_ids ?? [];
  const chapitreIds = objet.chapitre_ids ?? [];
  const amenagementIds = objet.amenagement_ids ?? [];
  const noms = (famille) => criteres.filter((c) => c.famille === famille && ids.includes(c.id)).map((c) => c.libelle);
  const troubles = noms('trouble');
  const difficultes = noms('difficulte');
  const chapitres = catalogue.filter((c) => chapitreIds.includes(c.id));
  const details = catalogue.flatMap((c) => c.items.filter((i) => amenagementIds.includes(i.id)));
  const affiches = troubles.length + difficultes.length + chapitres.length + details.length;
  const poses = ids.length + chapitreIds.length + amenagementIds.length;
  const autres = [
    ['Autre trouble', objet.autre_trouble],
    ['Autre difficulté', objet.autre_difficulte],
    ['Autre aménagement', objet.autre_amenagement],
  ].filter(([, texte]) => texte);

  return (
    <section className="plai-card bloc">
      <h2>Pour qui ?</h2>
      <p className="champ-aide">{MENTION_INDICATIVE}</p>
      {poses === 0 && autres.length === 0 && <p>Aucun critère posé.</p>}
      {poses > affiches && (
        <p role="status">Liste indisponible : {poses - affiches} critère{poses - affiches > 1 ? 's' : ''} ou aménagement{poses - affiches > 1 ? 's' : ''} posé{poses - affiches > 1 ? 's' : ''} ne peu{poses - affiches > 1 ? 'vent' : 't'} pas être affiché{poses - affiches > 1 ? 's' : ''} pour le moment.</p>
      )}
      <dl className="definitions">
        {troubles.length > 0 && <><dt>Troubles</dt><dd>{troubles.map((t) => <span key={t} className="pastille">{t}</span>)}</dd></>}
        {difficultes.length > 0 && <><dt>Difficultés d'apprentissage</dt><dd>{difficultes.map((t) => <span key={t} className="pastille">{t}</span>)}</dd></>}
        {chapitres.length > 0 && (
          <><dt>Aménagements : chapitres entiers</dt><dd><ul>{chapitres.map((c) => <li key={c.id}>{c.titre}</li>)}</ul></dd></>
        )}
        {details.length > 0 && (
          <>
            <dt>Aménagements précis</dt>
            <dd>
              <ul>
                {details.map((i) => (
                  <li key={i.id}>
                    <span className={`etiquette etiquette-${i.etiquette.toLowerCase()}`}>{i.etiquette}</span> {i.libelle}
                    {i.desactive && <em> (désactivé dans AménagActif)</em>}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {autres.map(([libelle, texte]) => <Fragment key={libelle}><dt>{libelle}</dt><dd>{texte}</dd></Fragment>)}
      </dl>
    </section>
  );
}
