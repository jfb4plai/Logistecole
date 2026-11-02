import { createClient } from '@supabase/supabase-js';

const ROLES = ['admin', 'gestionnaire', 'lecture', 'emprunteur'];
const PLAFOND_PAR_JOUR = 100;
const MAX_PAR_ENVOI = 50;
const ADRESSE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function creerHandler({ creerClient = createClient, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });

    const jeton = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!jeton) return res.status(401).json({ erreur: 'Connexion requise' });

    const { orgId, role } = req.body || {};
    const brut = Array.isArray(req.body?.emails) ? req.body.emails : req.body?.email ? [req.body.email] : [];
    if (!orgId || !ROLES.includes(role) || brut.length === 0) {
      return res.status(400).json({ erreur: 'Adresses, rôle ou organisation invalide' });
    }
    if (brut.length > MAX_PAR_ENVOI) {
      return res.status(400).json({ erreur: `Au plus ${MAX_PAR_ENVOI} adresses par envoi` });
    }
    const adresses = [...new Set(brut.map((e) => String(e || '').trim().toLowerCase()))];

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
    if ((count ?? 0) + adresses.length > PLAFOND_PAR_JOUR) {
      return res.status(429).json({ erreur: `Trop d'ajouts aujourd'hui (${PLAFOND_PAR_JOUR} par jour), réessayez demain` });
    }

    const resultats = [];
    for (const email of adresses) {
      if (!ADRESSE.test(email)) { resultats.push({ email, ok: false, erreur: 'Adresse invalide' }); continue; }
      let userId = (await admin.rpc('logi_id_par_email', { p_email: email })).data;
      let invite = false;
      if (!userId) {
        const { data: inv, error: errInv } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: env.SITE_URL });
        if (errInv || !inv?.user) { resultats.push({ email, ok: false, erreur: 'Envoi de l\'invitation impossible' }); continue; }
        userId = inv.user.id;
        invite = true;
      }
      const { error: errMembre } = await admin
        .from('logi_membres').upsert({ user_id: userId, org_id: orgId, role, email }, { onConflict: 'user_id,org_id' });
      if (errMembre) { resultats.push({ email, ok: false, erreur: 'Enregistrement du membre impossible' }); continue; }
      resultats.push({ email, ok: true, invite });
    }
    return res.status(200).json({
      ok: true,
      resultats,
      invites: resultats.filter((r) => r.ok && r.invite).length,
      rattaches: resultats.filter((r) => r.ok && !r.invite).length,
      echecs: resultats.filter((r) => !r.ok).length,
    });
  };
}

export default creerHandler();
