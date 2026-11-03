// Ajoute à un objet lu en base les identifiants de ses critères, chapitres et aménagements liés.
export function normaliserLiens(objet) {
  const { logi_objets_criteres: criteres, logi_objets_amenagements: amenagements, ...reste } = objet;
  return {
    ...reste,
    critere_ids: (criteres ?? []).map((l) => l.critere_id),
    chapitre_ids: (amenagements ?? []).map((l) => l.chapitre_id).filter(Boolean),
    amenagement_ids: (amenagements ?? []).map((l) => l.amenagement_id).filter(Boolean),
  };
}
