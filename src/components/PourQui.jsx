import ListeACocher from './ListeACocher.jsx';
import SelecteurAmenagements from './SelecteurAmenagements.jsx';
import { MENTION_INDICATIVE } from '../domain/criteres.js';

const TEXTE_ERREUR = 'Les listes n\'ont pas pu être chargées : vous pouvez enregistrer la fiche sans toucher aux critères.';

// Bloc « Pour qui ? » : troubles, difficultés, aménagements. valeur = { critereIds, selection, autres }.
export default function PourQui({ criteres, catalogue, valeur, onChange, chargement = false, erreur = null, sansAutre = false, texteErreur = TEXTE_ERREUR }) {
  const options = (famille) => criteres.filter((c) => c.famille === famille).map((c) => ({ value: c.id, label: c.libelle, aide: c.aide }));
  const changerFamille = (famille) => (vals) => {
    const deLaFamille = new Set(criteres.filter((c) => c.famille === famille).map((c) => c.id));
    onChange({ ...valeur, critereIds: [...valeur.critereIds.filter((id) => !deLaFamille.has(id)), ...vals] });
  };
  const valeursDe = (famille) => valeur.critereIds.filter((id) => criteres.some((c) => c.id === id && c.famille === famille));
  const changerAutre = (famille) => (a) => onChange({ ...valeur, autres: { ...valeur.autres, [famille]: a } });
  const pret = !chargement && !erreur;

  return (
    <section className="plai-card bloc-pour-qui" aria-labelledby="pour-qui-titre">
      <h2 id="pour-qui-titre">Pour qui ?</h2>
      <p className="champ-aide">{MENTION_INDICATIVE}</p>
      {chargement && <p className="chargement">Chargement des listes…</p>}
      {erreur && <p className="plai-error" role="alert">{texteErreur}</p>}
      {pret && (
        <>
          <ListeACocher id="troubles" label="Troubles concernés" aide="Cochez les troubles pour lesquels cet objet peut aider. Ils servent à le retrouver en recherche."
            options={options('trouble')} valeurs={valeursDe('trouble')} onChange={changerFamille('trouble')}
            autre={valeur.autres.trouble} onAutre={changerAutre('trouble')} sansAutre={sansAutre} />
          <ListeACocher id="difficultes" label="Difficultés d'apprentissage" aide="Cochez les difficultés visées, avec ou sans diagnostic. Elles servent à retrouver l'objet en recherche."
            options={options('difficulte')} valeurs={valeursDe('difficulte')} onChange={changerFamille('difficulte')}
            autre={valeur.autres.difficulte} onAutre={changerAutre('difficulte')} sansAutre={sansAutre}
            placeholderAutre="Ex. : difficulté à copier du tableau" />
          <SelecteurAmenagements id="amenagements" label="Aménagements raisonnables et universels"
            aide="Même catalogue qu'AménagActif. Cochez un chapitre entier, ou dépliez-le pour choisir des aménagements précis."
            catalogue={catalogue} selection={valeur.selection} onChange={(s) => onChange({ ...valeur, selection: s })}
            autre={valeur.autres.amenagement} onAutre={changerAutre('amenagement')} sansAutre={sansAutre} />
        </>
      )}
    </section>
  );
}
