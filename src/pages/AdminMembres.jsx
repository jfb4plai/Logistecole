import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import { listerMembres, changerRole, retirerMembre, inviterMembres } from '../data/membres.js';
import { messageErreur } from '../lib/erreurs.js';
import { extraireAdresses } from '../domain/adresses.js';
import ChampGuide from '../components/ChampGuide.jsx';

const ROLES = [
  { value: 'emprunteur', label: 'Enseignant (peut emprunter)' },
  { value: 'gestionnaire', label: 'Gestionnaire' },
  { value: 'lecture', label: 'Lecture seule' },
  { value: 'admin', label: 'Administrateur' },
];

export default function AdminMembres() {
  const { orgId } = useOrg();
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['membres', orgId], queryFn: () => listerMembres(orgId) });
  const [texte, setTexte] = useState('');
  const [role, setRole] = useState('emprunteur');
  const [erreur, setErreur] = useState('');
  const [rapport, setRapport] = useState(null);
  const [occupe, setOccupe] = useState(false);

  async function agir(fn) {
    setErreur(''); setRapport(null);
    try { await fn(); qc.invalidateQueries({ queryKey: ['membres', orgId] }); } catch (e) { setErreur(messageErreur(e)); }
  }

  async function inviter(e) {
    e.preventDefault();
    const emails = extraireAdresses(texte);
    if (emails.length === 0) { setErreur('Saisissez au moins une adresse e-mail.'); return; }
    setOccupe(true);
    await agir(async () => {
      const r = await inviterMembres({ orgId, emails, role });
      setRapport(r);
      setTexte(r.resultats.filter((x) => !x.ok).map((x) => x.email).join('\n'));
    });
    setOccupe(false);
  }

  return (
    <section>
      <h2>Membres</h2>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {rapport && (
        <div className="plai-success" role="status">
          <p>{rapport.ajoutes} personne{rapport.ajoutes > 1 ? 's' : ''} ajoutée{rapport.ajoutes > 1 ? 's' : ''}{rapport.echecs > 0 && `, ${rapport.echecs} en échec`}.</p>
          <p className="champ-aide">Celles qui n'avaient pas encore de compte reçoivent un e-mail d'invitation ; les autres ont directement accès.</p>
          {rapport.resultats.filter((x) => !x.ok).map((x) => <p key={x.email}>{x.email} : {x.erreur}</p>)}
        </div>
      )}
      <form className="plai-card" onSubmit={inviter}>
        <ChampGuide id="inv-emails" label="Adresses e-mail à inviter" obligatoire aide="Une adresse par ligne, ou séparées par des virgules : collez directement une colonne de votre tableur. 50 adresses au plus par envoi, 100 ajouts par jour. Chaque personne reçoit un lien de connexion à son adresse. Les adresses en échec restent dans la zone pour que vous puissiez les corriger.">
          <textarea id="inv-emails" aria-describedby="inv-emails-aide" required rows={5} className="plai-input" placeholder={'prenom.nom@ecole-liege.be\nautre.prenom@ecole-liege.be'} value={texte} onChange={(e) => setTexte(e.target.value)} />
        </ChampGuide>
        <ChampGuide id="inv-role" label="Rôle donné à toutes ces personnes" aide="Enseignant : consulte, emprunte, rend ses prêts, réserve, signale une panne. Gestionnaire : gère le matériel et les prêts. Lecture seule : consulte. Administrateur : tout, y compris les membres.">
          <select id="inv-role" aria-describedby="inv-role-aide" className="plai-input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </ChampGuide>
        <button className="plai-btn" disabled={occupe}>{occupe ? 'Envoi…' : 'Inviter'}</button>
      </form>

      <div className="defile">
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
      </div>
    </section>
  );
}
