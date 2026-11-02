export function estSousSeuil(o) {
  return !!o.consommable && o.seuil_min != null && o.quantite != null && o.quantite <= o.seuil_min;
}
