// memberships : [{ orgId, role, organisation: { id, nom, type } }]
export function choisirOrganisationActive(memberships, idMemorise) {
  if (!Array.isArray(memberships) || memberships.length === 0) return null;
  return memberships.find((m) => m.orgId === idMemorise) ?? memberships[0];
}
