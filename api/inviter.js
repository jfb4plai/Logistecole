import { createClient } from '@supabase/supabase-js';

const ROLES = ['admin', 'gestionnaire', 'lecture'];
const PLAFOND_PAR_JOUR = 20;

export function creerHandler({ creerClient = createClient, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });

    const jeton = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!jeton) return res.status(401).json({ erreur: 'Connexion requise' });

    const { orgId, email, role } = req.body || {};
    const adresse = String(email || '').trim().toLowerCase();
    if (!orgId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse) || !ROLES.includes(role)) {
      return res.status(400).json({ erreur: 'Adresse, rôle ou organisation invalide' });
    }

    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    const service = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) return res.status(500).json({ erreur: 'Configuration serveur incomplète' });

    // 1. Qui appelle, et est-ce un admin de cette organisation ? (RLS appliquée avec son jeton)
    const appelant = creerClient(url, anon, { global: { headers: { Authorization: `Bearer ${jeton}` } } });
    const { data: u, error: errUser } = await appelant.auth.getUser(jeton);
    if (errUser || !u?.user) return res.status(401).json({ erreur: 'Session invalide' });
    const { data: moi } = await appelant
      .from('logi_membres').select('role').eq('org_id', orgId).eq('user_id', u.user.id).maybeSingle();
    if (moi?.role !== 'admin') return res.status(403).json({ erreur: 'Réservé aux administrateurs de cette organisation' });

    // 2. Le reste avec la clé service, côté serveur uniquement.
    const admin = creerClient(url, service);
    const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from('logi_membres').select('user_id', { count: 'exact', head: true }).eq('org_id', orgId).gte('cree_le', depuis);
    if ((count ?? 0) >= PLAFOND_PAR_JOUR) return res.status(429).json({ erreur: 'Trop d\'ajouts aujourd\'hui, réessayez demain' });

    let userId = (await admin.rpc('logi_id_par_email', { p_email: adresse })).data;
    let invite = false;
    if (!userId) {
      const { data: inv, error: errInv } = await admin.auth.admin.inviteUserByEmail(adresse, { redirectTo: env.SITE_URL });
      if (errInv || !inv?.user) return res.status(502).json({ erreur: 'Envoi de l\'invitation impossible' });
      userId = inv.user.id;
      invite = true;
    }

    const { error: errMembre } = await admin
      .from('logi_membres').upsert({ user_id: userId, org_id: orgId, role, email: adresse }, { onConflict: 'user_id,org_id' });
    if (errMembre) return res.status(500).json({ erreur: 'Enregistrement du membre impossible' });
    return res.status(200).json({ ok: true, invite });
  };
}

export default creerHandler();
