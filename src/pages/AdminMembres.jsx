import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import { listerMembres, changerRole, retirerMembre, inviterMembre } from '../data/membres.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'gestionnaire', label: 'Gestionnaire' },
  { value: 'lecture', label: 'Lecture seule' },
];

export default function AdminMembres() {
  const { orgId } = useOrg();
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['membres', orgId], queryFn: () => listerMembres(orgId) });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('gestionnaire');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  async function agir(fn, succes = '') {
    setErreur(''); setInfo('');
    try { const r = await fn(); qc.invalidateQueries({ queryKey: ['membres', orgId] }); if (succes) setInfo(typeof succes === 'function' ? succes(r) : succes); } catch (e) { setErreur(messageErreur(e)); }
  }

  return (
    <section>
      <h2>Membres</h2>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {info && <p className="plai-success" role="status">{info}</p>}
      <form className="plai-card" onSubmit={(e) => { e.preventDefault(); agir(async () => { const r = await inviterMembre({ orgId, email, role }); setEmail(''); return r; }, (r) => r.invite ? 'Invitation envoyée par e-mail.' : 'Cette personne avait déjà un compte : elle a maintenant accès à votre organisation.'); }}>
        <ChampGuide id="inv-email" label="Adresse e-mail à inviter" obligatoire aide="La personne reçoit un lien de connexion à cette adresse. Utilisez son adresse professionnelle. Limite : 20 ajouts par jour.">
          <input id="inv-email" aria-describedby="inv-email-aide" type="email" required className="plai-input" placeholder="prenom.nom@ecole-liege.be" value={email} onChange={(e) => setEmail(e.target.value)} />
        </ChampGuide>
        <ChampGuide id="inv-role" label="Rôle" aide="Administrateur : tout gérer, y compris les membres. Gestionnaire : ajouter, modifier et déplacer le matériel. Lecture seule : consulter.">
          <select id="inv-role" aria-describedby="inv-role-aide" className="plai-input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </ChampGuide>
        <button className="plai-btn">Inviter</button>
      </form>

      <table className="tableau">
        <thead><tr><th>Adresse</th><th>Rôle</th><th></th></tr></thead>
        <tbody>
          {(q.data ?? []).map((m) => {
            const moi = m.user_id === session?.user?.id;
            return (
              <tr key={m.user_id}>
                <td>{m.email}{moi && ' (vous)'}</td>
                <td>
                  <select aria-label={`Rôle de ${m.email}`} className="plai-input" value={m.role} disabled={moi}
                    onChange={(e) => agir(() => changerRole(m.user_id, orgId, e.target.value))}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td>
                  {!moi && <button className="plai-btn-ghost" onClick={() => { if (window.confirm(`Retirer ${m.email} de l'organisation ?`)) agir(() => retirerMembre(m.user_id, orgId)); }}>Retirer</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
