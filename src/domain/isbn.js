const somme13 = (d) => d.slice(0, 12).split('').reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);

// Renvoie l'ISBN en 13 chiffres, ou null si la saisie n'est pas un ISBN valide (clé comprise).
export function normaliserIsbn(saisie) {
  const t = String(saisie ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(t)) return (10 - (somme13(t) % 10)) % 10 === Number(t[12]) ? t : null;
  if (!/^\d{9}[\dX]$/.test(t)) return null;
  const s = t.split('').reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
  if (s % 11 !== 0) return null;
  const d12 = `978${t.slice(0, 9)}`;
  return `${d12}${(10 - (somme13(d12) % 10)) % 10}`;
}
