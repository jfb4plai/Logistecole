import { supabase } from '../lib/supabase.js';

function verifier(error) {
  if (error) throw error;
}

export async function listerMembres(orgId) {
  const { data, error } = await supabase.from('logi_membres').select('user_id, email, role, cree_le').eq('org_id', orgId).order('email');
  verifier(error);
  return data;
}

export async function changerRole(userId, orgId, role) {
  const { error } = await supabase.from('logi_membres').update({ role }).eq('user_id', userId).eq('org_id', orgId);
  verifier(error);
}

export async function retirerMembre(userId, orgId) {
  const { error } = await supabase.from('logi_membres').delete().eq('user_id', userId).eq('org_id', orgId);
  verifier(error);
}

export async function inviterMembre({ orgId, email, role }) {
  const { data } = await supabase.auth.getSession();
  const rep = await fetch('/api/inviter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify({ orgId, email, role }),
  });
  const corps = await rep.json().catch(() => ({}));
  if (!rep.ok) throw { status: rep.status, message: corps.erreur ?? '' };
  return corps;
}
