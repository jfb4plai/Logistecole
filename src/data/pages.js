// La base plafonne chaque réponse (1000 lignes par défaut) : on lit page après page.
// demanderPage(de, a) renvoie les lignes de l'intervalle [de, a] inclus.
export async function lireToutesLesPages(demanderPage, { taille = 1000, max = 10000 } = {}) {
  const lignes = [];
  for (let de = 0; de < max; de += taille) {
    const page = await demanderPage(de, de + taille - 1);
    lignes.push(...page);
    if (page.length < taille) break;
  }
  return lignes.slice(0, max);
}
