// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { creerHandler } from '../../api/inviter.js';

const ENV = { SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', SITE_URL: 'https://logistecole.jfb4plai.com' };

function faux({ user = { id: 'u1' }, roleAppelant = 'admin', recents = 0, idExistant = null } = {}) {
  const appels = { invite: [], upsert: [] };
  const admin = {
    rpc: async () => ({ data: idExistant, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ gte: async () => ({ count: recents, error: null }) }) }),
      upsert: async (ligne) => { appels.upsert.push(ligne); return { error: null }; },
    }),
    auth: { admin: { inviteUserByEmail: async (email, opts) => { appels.invite.push([email, opts]); return { data: { user: { id: 'nouveau' } }, error: null }; } } },
  };
  const appelant = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: roleAppelant ? { role: roleAppelant } : null, error: null }) }) }) }) }),
  };
  return { creerClient: (_url, cle) => (cle === 'service' ? admin : appelant), appels };
}

function reponse() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const requete = (over = {}) => ({
  method: 'POST',
  headers: { authorization: 'Bearer jeton' },
  body: { orgId: 'o1', email: 'Prof@Ecole-Liege.be ', role: 'gestionnaire' },
  ...over,
});

describe('/api/inviter', () => {
  it('refuse une méthode autre que POST', async () => {
    const res = reponse();
    await creerHandler({ creerClient: faux().creerClient, env: ENV })(requete({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });
  it('refuse sans jeton', async () => {
    const res = reponse();
    await creerHandler({ creerClient: faux().creerClient, env: ENV })(requete({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
  });
  it('refuse une adresse, un rôle ou une organisation invalide', async () => {
    for (const body of [{ orgId: 'o1', email: 'pas-un-mail', role: 'admin' }, { orgId: 'o1', email: 'a@b.be', role: 'roi' }, { email: 'a@b.be', role: 'admin' }]) {
      const res = reponse();
      await creerHandler({ creerClient: faux().creerClient, env: ENV })(requete({ body }), res);
      expect(res.statusCode).toBe(400);
    }
  });
  it('refuse un appelant qui n\'est pas admin de l\'organisation', async () => {
    for (const roleAppelant of ['gestionnaire', 'lecture', null]) {
      const res = reponse();
      await creerHandler({ creerClient: faux({ roleAppelant }).creerClient, env: ENV })(requete(), res);
      expect(res.statusCode).toBe(403);
    }
  });
  it('limite le nombre d\'ajouts par jour', async () => {
    const res = reponse();
    await creerHandler({ creerClient: faux({ recents: 20 }).creerClient, env: ENV })(requete(), res);
    expect(res.statusCode).toBe(429);
  });
  it('invite un nouvel utilisateur avec une redirection et crée le membre', async () => {
    const f = faux();
    const res = reponse();
    await creerHandler({ creerClient: f.creerClient, env: ENV })(requete(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, invite: true });
    expect(f.appels.invite[0][0]).toBe('prof@ecole-liege.be');
    expect(f.appels.invite[0][1].redirectTo).toBe('https://logistecole.jfb4plai.com');
    expect(f.appels.upsert[0]).toMatchObject({ user_id: 'nouveau', org_id: 'o1', role: 'gestionnaire', email: 'prof@ecole-liege.be' });
  });
  it('rattache un utilisateur déjà inscrit sans renvoyer d\'invitation', async () => {
    const f = faux({ idExistant: 'deja-la' });
    const res = reponse();
    await creerHandler({ creerClient: f.creerClient, env: ENV })(requete(), res);
    expect(res.body).toEqual({ ok: true, invite: false });
    expect(f.appels.invite).toHaveLength(0);
    expect(f.appels.upsert[0].user_id).toBe('deja-la');
  });
});
