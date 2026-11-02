function role() {
  try {
    const q = new URLSearchParams(window.location.search).get('role');
    if (q) sessionStorage.setItem('demoRole', q);
    return sessionStorage.getItem('demoRole') || 'admin';
  } catch { return 'admin'; }
}
export const OrgProvider = ({ children }) => children;
export function useOrg() {
  const r = role();
  return {
    memberships: [{ orgId: 'o1', role: r, organisation: { id: 'o1', nom: 'École de démonstration', type: 'ecole' } }],
    active: null, role: r, orgId: 'o1', orgNom: 'École de démonstration (démo : rien n\'est enregistré)', choisir: () => {}, loading: false, error: null,
  };
}
