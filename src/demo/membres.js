import { membres } from './store.js';

export const listerMembres = async () => JSON.parse(JSON.stringify(membres));
export const changerRole = async (id, _o, role) => { membres.find((m) => m.user_id === id).role = role; };
export const retirerMembre = async (id) => { membres.splice(membres.findIndex((m) => m.user_id === id), 1); };
export const inviterMembres = async ({ emails }) => ({
  ok: true, resultats: emails.map((email) => ({ email, ok: true, invite: true })), invites: emails.length, rattaches: 0, echecs: 0,
});
