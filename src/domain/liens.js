export const MAX_LIENS = 10;

// http et https seulement : jamais javascript:, data:, etc.
function normaliserUrl(brut) {
  const t = brut.trim();
  if (/^https?:\/\/[^\s]+$/i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return `https://${t}`;
  return null;
}

export function analyserLiens(texte) {
  const liens = [];
  const erreurs = [];
  const lignes = String(texte ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lignes.forEach((ligne, i) => {
    if (liens.length >= MAX_LIENS) {
      if (!erreurs.some((e) => e.includes(String(MAX_LIENS)))) erreurs.push(`Au plus ${MAX_LIENS} liens : les suivants sont ignorés.`);
      return;
    }
    const barre = ligne.indexOf('|');
    const titreSaisi = barre >= 0 ? ligne.slice(0, barre).trim() : '';
    const url = normaliserUrl(barre >= 0 ? ligne.slice(barre + 1) : ligne);
    if (!url || url.length > 500) {
      erreurs.push(`Ligne ${i + 1} : adresse invalide (http ou https attendu).`);
      return;
    }
    let titre = titreSaisi;
    if (!titre) {
      try { titre = new URL(url).hostname; } catch { titre = url; }
    }
    liens.push({ titre: titre.slice(0, 120), url });
  });
  return { liens, erreurs };
}

export function formaterLiens(liens) {
  return (liens ?? []).map((l) => `${l.titre} | ${l.url}`).join('\n');
}
