import { objets, criteres, chapitresAr, amenagementsAr } from './store.js';

const copie = (x) => JSON.parse(JSON.stringify(x));

export const listerCriteres = async () => copie(criteres);
export const listerCatalogueAmenagements = async () => copie({ chapitres: chapitresAr, amenagements: amenagementsAr });
export const definirCriteres = async (objetId, { critereIds, chapitreIds, amenagementIds }) => {
  Object.assign(objets.find((o) => o.id === objetId), { critere_ids: critereIds, chapitre_ids: chapitreIds, amenagement_ids: amenagementIds });
};
