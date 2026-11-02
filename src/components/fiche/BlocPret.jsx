import { useState } from 'react';
import { emprunter, preter, rendre, prolonger, creerEmprunteur } from '../../data/prets.js';
import { dateIso, dateLongue, echeanceParDefaut, statutPret } from '../../domain/echeance.js';
import { etatsRetourPossibles } from '../../domain/etats.js';
import { elementsDuKit, grouperParEtat, pretOuvertDe, trierGroupe, verifierPretPossible } from '../../domain/kit.js';
import { messageErreur } from '../../lib/erreurs.js';
import { formaterCode } from '../../domain/codes.js';
import ChampGuide from '../ChampGuide.jsx';

const TYPES = [
  { value: 'enseignant', label: 'Enseignant (initiales)', placeholder: 'Ex. : M.D.' },
  { value: 'eleve', label: 'Élève (code anonyme)', placeholder: 'Ex. : E12' },
  { value: 'organisation', label: 'Autre organisation', placeholder: 'Ex. : École communale de Herstal' },
];

export default function BlocPret({ objet, objets, prets, actions, emprunteurs, orgId, surChangement }) {
  const aujourdhui = new Date();
  const max = dateIso(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + 365));
  const [echeance, setEcheance] = useState(echeanceParDefaut(aujourdhui));
  const [commentaire, setCommentaire] = useState('');
  const [emprunteurId, setEmprunteurId] = useState('');
  const [typeNouveau, setTypeNouveau] = useState('enseignant');
  const [libelleNouveau, setLibelleNouveau] = useState('');
  const [absents, setAbsents] = useState(new Set());
  const [etatsChoisis, setEtatsChoisis] = useState({}); // prêt -> état choisi ; absent = état actuel de l'objet
  const [commentaireRetour, setCommentaireRetour] = useState('');
  const [nouvelleEcheance, setNouvelleEcheance] = useState(echeanceParDefaut(aujourdhui, 7));
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [occupe, setOccupe] = useState(false);

  const pret = pretOuvertDe(prets, objet.id);
  const groupe = pret ? trierGroupe(prets.filter((p) => p.groupe_id === pret.groupe_id && !p.retour_le)) : [];
  const possible = verifierPretPossible(objet, objets, prets);
  const etatActuel = (p) => objets.find((o) => o.id === p.objet_id)?.etat ?? 'bon';
  const etatChoisi = (p) => etatsChoisis[p.id] ?? etatActuel(p);
  const elements = elementsDuKit(objets, objet.id);

  async function agir(fn, message) {
    setErreur(''); setInfo(''); setOccupe(true);
    try { await fn(); setInfo(message); await surChangement(); } catch (e) { setErreur(messageErreur(e)); } finally { setOccupe(false); }
  }

  async function choisirEmprunteur() {
    if (emprunteurId) return emprunteurId;
    if (!libelleNouveau.trim()) throw { code: 'P0001', message: 'Choisissez un emprunteur ou saisissez-en un nouveau.' };
    return (await creerEmprunteur(orgId, typeNouveau, libelleNouveau)).id;
  }

  const statut = pret ? statutPret(pret) : null;
  const typeCourant = TYPES.find((t) => t.value === typeNouveau);

  return (
    <section className="plai-card bloc">
      <h2>Prêt</h2>
      {pret ? (
        <p>
          <strong>Prêté à {pret.logi_emprunteurs?.libelle ?? 'quelqu\'un'}.</strong>{' '}
          <span className={`badge-etat badge-${statut.niveau === 'retard' ? 'alerte' : statut.niveau === 'bientot' ? 'attention' : 'ok'}`}>{statut.libelle}</span>
        </p>
      ) : (
        <p><strong>{possible.ok ? 'Disponible.' : possible.raison}</strong></p>
      )}
      {elements.length > 0 && (
        <p className="champ-aide">
          Kit de {elements.length} élément{elements.length > 1 ? 's' : ''} : {elements.map((e) => e.nom).join(', ')}.
          {possible.ok && possible.exclus.length > 0 && ` Ne seront pas prêtés (hors service ou déjà prêtés) : ${possible.exclus.join(', ')}.`}
        </p>
      )}
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {info && <p className="plai-success" role="status">{info}</p>}

      {(actions.emprunter || actions.preter) && (
        <ChampGuide id="echeance" label="À rendre le" aide="Date de retour prévue. L'emprunteur la voit sur la fiche et dans « Mes emprunts ». Entre aujourd'hui et 365 jours.">
          <input id="echeance" type="date" aria-describedby="echeance-aide" className="plai-input" min={dateIso(aujourdhui)} max={max}
            value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </ChampGuide>
      )}
      {(actions.emprunter || actions.preter) && (
        <ChampGuide id="commentaire-pret" label="Pour quoi faire (facultatif)" aide="Un mot pour s'y retrouver : il est gardé dans l'historique. Pas de nom d'élève.">
          <input id="commentaire-pret" aria-describedby="commentaire-pret-aide" className="plai-input" maxLength={300}
            placeholder="Ex. : atelier de lecture en 4e primaire, lundi et mardi"
            value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
        </ChampGuide>
      )}
      {actions.emprunter && (
        <div className="actions">
          <button className="plai-btn btn-orange" disabled={occupe}
            onClick={() => agir(() => emprunter(objet.id, echeance, commentaire.trim() || null), `Emprunt enregistré : à rendre le ${dateLongue(echeance)}.`)}>
            Emprunter pour moi
          </button>
        </div>
      )}

      {actions.preter && (
        <>
          <ChampGuide id="emprunteur" label="Prêter à" aide="Choisissez une personne déjà connue, ou saisissez-en une nouvelle ci-dessous. Les enseignants avec un compte apparaissent après leur premier emprunt.">
            <select id="emprunteur" aria-describedby="emprunteur-aide" className="plai-input" value={emprunteurId} onChange={(e) => setEmprunteurId(e.target.value)}>
              <option value="">Nouvel emprunteur…</option>
              {emprunteurs.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
            </select>
          </ChampGuide>
          {!emprunteurId && (
            <>
              <ChampGuide id="type-emprunteur" label="Type d'emprunteur" aide="Pour un élève, utilisez un code anonyme, jamais un nom.">
                <select id="type-emprunteur" aria-describedby="type-emprunteur-aide" className="plai-input" value={typeNouveau} onChange={(e) => setTypeNouveau(e.target.value)}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </ChampGuide>
              <ChampGuide id="libelle-emprunteur" label="Initiales, code ou nom de l'organisation" aide="Apparaît dans l'historique et dans la liste des prêts. 60 caractères au maximum.">
                <input id="libelle-emprunteur" aria-describedby="libelle-emprunteur-aide" className="plai-input" maxLength={60}
                  placeholder={typeCourant.placeholder} value={libelleNouveau} onChange={(e) => setLibelleNouveau(e.target.value)} />
              </ChampGuide>
            </>
          )}
          <div className="actions">
            <button className="plai-btn" disabled={occupe}
              onClick={() => agir(async () => {
                const id = await choisirEmprunteur();
                await preter(objet.id, id, echeance, commentaire.trim() || null);
                setEmprunteurId(''); setLibelleNouveau('');
              }, `Prêt enregistré : à rendre le ${dateLongue(echeance)}.`)}>
              Enregistrer le prêt
            </button>
          </div>
        </>
      )}

      {actions.rendre && pret && (
        <div className="bloc-sous">
          <h3>Retour</h3>
          {groupe.length > 1 ? (
            <fieldset className="liste-cases">
              <legend className="plai-label">Éléments revenus et leur état</legend>
              <ul className="liste-cases">
                {groupe.map((p) => (
                  <li key={p.id} className="ligne-retour">
                    <label>
                      <input type="checkbox" checked={!absents.has(p.id)}
                        onChange={() => setAbsents((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} />
                      <span>{p.logi_objets?.nom} <span className="code-court">({formaterCode(p.logi_objets?.code ?? '')})</span></span>
                    </label>
                    <select aria-label={`État de ${p.logi_objets?.nom}`} className="plai-input select-etat" disabled={absents.has(p.id)}
                      value={etatChoisi(p)} onChange={(e) => setEtatsChoisis((c) => ({ ...c, [p.id]: e.target.value }))}>
                      {etatsRetourPossibles(etatActuel(p)).map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
              <p className="champ-aide">L'état proposé est celui du départ : changez-le seulement pour un élément abîmé. Un élément non coché reste prêté et la fiche du kit note qu'il manque.</p>
            </fieldset>
          ) : (
            <ChampGuide id="etat-retour" label="État au retour" aide="L'état proposé est celui du départ. Choisissez « Usé », « Défectueux » ou « Perdu » si l'objet est revenu abîmé : cela change aussi son état. Un objet ne revient jamais en meilleur état qu'au départ.">
              <select id="etat-retour" aria-describedby="etat-retour-aide" className="plai-input" value={etatChoisi(groupe[0])}
                onChange={(e) => setEtatsChoisis({ [groupe[0].id]: e.target.value })}>
                {etatsRetourPossibles(etatActuel(groupe[0])).map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </ChampGuide>
          )}
          <ChampGuide id="commentaire-retour" label="Remarque au retour (facultatif)" aide="Ce que vous constatez : rayure, câble manquant, tout est en ordre. Elle est gardée avec chaque élément rendu.">
            <input id="commentaire-retour" aria-describedby="commentaire-retour-aide" className="plai-input" maxLength={300}
              placeholder="Ex. : écran fissuré en bas à gauche" value={commentaireRetour} onChange={(e) => setCommentaireRetour(e.target.value)} />
          </ChampGuide>
          <div className="actions">
            <button className="plai-btn" disabled={occupe || groupe.every((p) => absents.has(p.id))}
              onClick={() => agir(async () => {
                // L'état est choisi par élément ; la base reçoit un retour par état choisi.
                const lignes = groupe.filter((p) => !absents.has(p.id)).map((p) => ({ id: p.id, etat: etatChoisi(p) }));
                for (const g of grouperParEtat(lignes)) await rendre(g.ids, g.etat, commentaireRetour.trim() || null);
                setAbsents(new Set()); setEtatsChoisis({}); setCommentaireRetour('');
              }, 'Retour enregistré.')}>
              Enregistrer le retour
            </button>
          </div>
        </div>
      )}

      {actions.prolonger && pret && (
        <div className="bloc-sous">
          <h3>Prolonger</h3>
          <ChampGuide id="prolonger" label="Nouvelle date de retour" aide="S'applique à tout le kit. Entre aujourd'hui et 365 jours.">
            <div className="bloc-action">
              <input id="prolonger" type="date" aria-describedby="prolonger-aide" className="plai-input" min={dateIso(aujourdhui)} max={max}
                value={nouvelleEcheance} onChange={(e) => setNouvelleEcheance(e.target.value)} />
              <button className="plai-btn-ghost" disabled={occupe} onClick={() => agir(() => prolonger(pret.id, nouvelleEcheance), `Prêt prolongé jusqu'au ${dateLongue(nouvelleEcheance)}.`)}>Prolonger</button>
            </div>
          </ChampGuide>
        </div>
      )}
    </section>
  );
}
