// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { creerHandler } from '../../api/inviter.js';

const ENV = { SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', SITE_URL: 'https://logistecole.jfb4plai.com' };

function faux({ user = { id: 'u1' }, roleAppelant = 'admin', recents = 0, existants = {}, echecInvitation = [] } = {}) {
  const appels = { invite: [], upsert: [] };
  const admin = {
    rpc: async (_nom, args) => ({ data: existants[args.p_email] ?? null, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ gte: async () => ({ count: recents, error: null }) }) }),
      upsert: async (ligne) => { appels.upsert.push(ligne); return { error: null }; },
    }),
    auth: {
      admin: {
        inviteUserByEmail: async (email, opts) => {
          appels.invite.push([email, opts]);
          if (echecInvitation.includes(email)) return { data: null, error: { message: 'boom' } };
          return { data: { user: { id: `nouveau-${email}` } }, error: null };
        },
      },
    },
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
  body: { orgId: 'o1', emails: ['Prof@Ecole-Liege.be '], role: 'gestionnaire' },
  ...over,
});
const lancer = async (f, req) => { const res = reponse(); await creerHandler({ creerClient: f.creerClient, env: ENV })(req, res); return res; };

describe('/api/inviter', () => {
  it('refuse une méthode autre que POST', async () => {
    expect((await lancer(faux(), requete({ method: 'GET' }))).statusCode).toBe(405);
  });
  it('refuse sans jeton', async () => {
    expect((await lancer(faux(), requete({ headers: {} }))).statusCode).toBe(401);
  });
  it('refuse un rôle ou une organisation invalide, ou une liste vide', async () => {
    for (const body of [{ orgId: 'o1', emails: ['a@b.be'], role: 'roi' }, { emails: ['a@b.be'], role: 'admin' }, { orgId: 'o1', emails: [], role: 'admin' }, { orgId: 'o1', role: 'admin' }]) {
      expect((await lancer(faux(), requete({ body }))).statusCode).toBe(400);
    }
  });
  it('accepte le rôle enseignant (emprunteur)', async () => {
    const res = await lancer(faux(), requete({ body: { orgId: 'o1', emails: ['prof@ecole.be'], role: 'emprunteur' } }));
    expect(res.statusCode).toBe(200);
  });
  it('refuse un appelant qui n\'est pas admin de l\'organisation', async () => {
    for (const roleAppelant of ['gestionnaire', 'lecture', 'emprunteur', null]) {
      expect((await lancer(faux({ roleAppelant }), requete())).statusCode).toBe(403);
    }
  });
  it('refuse plus de 50 adresses par envoi', async () => {
    const emails = Array.from({ length: 51 }, (_, i) => `p${i}@ecole.be`);
    expect((await lancer(faux(), requete({ body: { orgId: 'o1', emails, role: 'emprunteur' } }))).statusCode).toBe(400);
  });
  it('limite à 100 ajouts par jour en comptant les adresses de l\'envoi', async () => {
    expect((await lancer(faux({ recents: 100 }), requete())).statusCode).toBe(429);
    const deux = requete({ body: { orgId: 'o1', emails: ['a@b.be', 'c@d.be'], role: 'emprunteur' } });
    expect((await lancer(faux({ recents: 99 }), deux)).statusCode).toBe(429);
    expect((await lancer(faux({ recents: 98 }), deux)).statusCode).toBe(200);
  });
  it('invite un nouvel utilisateur avec une redirection et crée le membre', async () => {
    const f = faux();
    const res = await lancer(f, requete());
    expect(res.statusCode).toBe(200);
    expect(res.body.resultats).toEqual([{ email: 'prof@ecole-liege.be', ok: true, invite: true }]);
    expect(f.appels.invite[0][0]).toBe('prof@ecole-liege.be');
    expect(f.appels.invite[0][1].redirectTo).toBe('https://logistecole.jfb4plai.com');
    expect(f.appels.upsert[0]).toMatchObject({ user_id: 'nouveau-prof@ecole-liege.be', org_id: 'o1', role: 'gestionnaire', email: 'prof@ecole-liege.be' });
  });
  it('rattache un utilisateur déjà inscrit sans renvoyer d\'invitation', async () => {
    const f = faux({ existants: { 'prof@ecole-liege.be': 'deja-la' } });
    const res = await lancer(f, requete());
    expect(res.body.resultats).toEqual([{ email: 'prof@ecole-liege.be', ok: true, invite: false }]);
    expect(f.appels.invite).toHaveLength(0);
    expect(f.appels.upsert[0].user_id).toBe('deja-la');
  });
  it('traite une liste : doublons fusionnés, adresse invalide et échec signalés sans bloquer les autres', async () => {
    const f = faux({ existants: { 'b@ecole.be': 'id-b' }, echecInvitation: ['d@ecole.be'] });
    const res = await lancer(f, requete({ body: { orgId: 'o1', role: 'emprunteur', emails: ['A@ecole.be', 'a@ecole.be', 'b@ecole.be', 'pas-un-mail', 'd@ecole.be', 'e@ecole.be'] } }));
    expect(res.statusCode).toBe(200);
    expect(res.body.resultats.map((r) => [r.email, r.ok, r.invite ?? null])).toEqual([
      ['a@ecole.be', true, true],
      ['b@ecole.be', true, false],
      ['pas-un-mail', false, null],
      ['d@ecole.be', false, null],
      ['e@ecole.be', true, true],
    ]);
    expect(res.body.resultats.find((r) => r.email === 'pas-un-mail').erreur).toMatch(/invalide/i);
    expect(res.body).toMatchObject({ ok: true, invites: 2, rattaches: 1, echecs: 2 });
    expect(f.appels.upsert).toHaveLength(3);
  });
});
