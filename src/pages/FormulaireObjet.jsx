import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import { creerObjets, modifierObjet, getObjetParCode, uploaderPhoto, supprimerPhoto } from '../data/objets.js';
import { useCategories, useEmplacements } from '../data/hooks.js';
import { validerLot } from '../domain/lot.js';
import { genererCodes, normaliserCode } from '../domain/codes.js';
import { validerFichierPhoto, compresserImage } from '../domain/image.js';
import { ETATS } from '../domain/etats.js';
import { peutEcrire } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

const VIDE = { nom: '', categorie_id: '', emplacement_id: '', etat: 'bon', notes: '', quantite: '1' };

export default function FormulaireObjet({ mode }) {
  const modif = mode === 'modifier';
  const { code: codeUrl } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { orgId, role } = useOrg();
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];

  const existantQ = useQuery({
    queryKey: ['objet', normaliserCode(codeUrl)], enabled: modif && !!normaliserCode(codeUrl),
    queryFn: () => getObjetParCode(normaliserCode(codeUrl)),
  });
  const [f, setF] = useState(VIDE);
  const [fichier, setFichier] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    const o = existantQ.data;
    if (modif && o) setF({ ...VIDE, nom: o.nom, categorie_id: o.categorie_id ?? '', emplacement_id: o.emplacement_id ?? '', etat: o.etat, notes: o.notes ?? '' });
  }, [modif, existantQ.data]);

  if (!peutEcrire(role)) return <p className="plai-error" role="alert">Votre rôle ne permet pas d'ajouter ou de modifier du matériel.</p>;
  if (modif && existantQ.isLoading) return <p className="chargement">Chargement…</p>;
  if (modif && !existantQ.data) return <p className="plai-error" role="alert">Objet introuvable.</p>;
  if (cats.length === 0) {
    return (
      <div className="plai-card">
        <h1>Aucune catégorie</h1>
        <p>Une catégorie est nécessaire pour classer le matériel. Un administrateur peut en ajouter dans l'<Link to="/admin">administration</Link>.</p>
      </div>
    );
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    if (!f.categorie_id) { setErreur('Choisissez une catégorie.'); return; }
    const lot = modif ? validerLot({ nom: f.nom, quantite: 1 }) : validerLot({ nom: f.nom, quantite: f.quantite });
    if (!lot.ok) { setErreur(lot.erreur); return; }
    if (fichier) {
      const v = validerFichierPhoto(fichier);
      if (!v.ok) { setErreur(v.erreur); return; }
    }

    setEnvoi(true);
    let photoPath = null;
    try {
      if (fichier) photoPath = await uploaderPhoto(orgId, await compresserImage(fichier));
      const commun = {
        nom: lot.nom,
        categorie_id: f.categorie_id,
        emplacement_id: f.emplacement_id || null,
        notes: f.notes.trim() || null,
      };

      if (modif) {
        const champs = { ...commun };
        if (photoPath) champs.photo_path = photoPath;
        await modifierObjet(existantQ.data.id, champs);
        qc.invalidateQueries({ queryKey: ['objet'] });
        qc.invalidateQueries({ queryKey: ['objets', orgId] });
        navigate(`/o/${existantQ.data.code}`);
        return;
      }

      // Collision de code improbable : jusqu'à 3 tentatives avec de nouveaux codes.
      let crees;
      for (let essai = 0; ; essai++) {
        const codes = genererCodes(lot.quantite);
        try {
          crees = await creerObjets(orgId, codes.map((code) => ({ ...commun, etat: f.etat, photo_path: photoPath, code })));
          break;
        } catch (err) {
          if (err?.code !== '23505' || essai >= 2) throw err;
        }
      }
      qc.invalidateQueries({ queryKey: ['objets', orgId] });
      const codes = crees.map((c) => c.objet_code);
      navigate(codes.length === 1 ? `/o/${codes[0]}` : `/etiquettes?codes=${codes.join(',')}`);
    } catch (err) {
      if (photoPath) await supprimerPhoto(photoPath);
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} noValidate>
      <h1>{modif ? 'Modifier la fiche' : 'Ajouter du matériel'}</h1>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}

      <ChampGuide id="nom" label="Nom de l'objet" obligatoire aide="Apparaît dans la liste et sur l'étiquette imprimée. Soyez précis pour le retrouver : 120 caractères au maximum.">
        <input id="nom" aria-describedby="nom-aide" className="plai-input" maxLength={120} placeholder="Ex. : Valise de 16 tablettes, salle 12" value={f.nom} onChange={maj('nom')} />
      </ChampGuide>

      <ChampGuide id="categorie" label="Catégorie" obligatoire aide="Sert à filtrer la liste. Les catégories sont gérées par l'administrateur de votre organisation.">
        <select id="categorie" aria-describedby="categorie-aide" className="plai-input" value={f.categorie_id} onChange={maj('categorie_id')}>
          <option value="">Choisir une catégorie…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </ChampGuide>

      <ChampGuide id="emplacement" label="Emplacement" aide="Où l'objet est rangé (facultatif). Vous pourrez le déplacer plus tard : chaque déplacement est gardé dans l'historique.">
        <select id="emplacement" aria-describedby="emplacement-aide" className="plai-input" value={f.emplacement_id} onChange={maj('emplacement_id')}>
          <option value="">Aucun emplacement</option>
          {emps.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      </ChampGuide>

      {!modif && (
        <>
          <ChampGuide id="etat" label="État à l'arrivée" aide="L'état de l'objet au moment où vous l'enregistrez. Il pourra changer ensuite et chaque changement est tracé.">
            <select id="etat" aria-describedby="etat-aide" className="plai-input" value={f.etat} onChange={maj('etat')}>
              {ETATS.filter((e) => e.value !== 'sorti').map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </ChampGuide>

          <ChampGuide id="quantite" label="Nombre d'exemplaires identiques" obligatoire aide="Pour 16 tablettes identiques, tapez 16 : chacune reçoit son propre code et sa propre étiquette. Entre 1 et 100 à la fois.">
            <input id="quantite" aria-describedby="quantite-aide" className="plai-input" inputMode="numeric" placeholder="Ex. : 16" value={f.quantite} onChange={maj('quantite')} />
          </ChampGuide>
        </>
      )}

      <ChampGuide id="photo" label="Photo" aide="Facultative. Elle est réduite automatiquement (environ 200 Ko) avant l'envoi. Avec plusieurs exemplaires, la même photo sert pour tous.">
        <input id="photo" aria-describedby="photo-aide" className="plai-input" type="file" accept="image/*" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
      </ChampGuide>

      <ChampGuide id="notes" label="Notes" aide="Tout ce qui aide à s'en servir ou à le retrouver : numéro de série, mot de passe du chariot, accessoires fournis. Pas de nom d'élève.">
        <textarea id="notes" aria-describedby="notes-aide" className="plai-input" rows={3} maxLength={2000} placeholder="Ex. : chargeurs dans le tiroir du bas, clé chez la secrétaire" value={f.notes} onChange={maj('notes')} />
      </ChampGuide>

      <div className="actions">
        <button className="plai-btn" disabled={envoi}>{envoi ? 'Enregistrement…' : modif ? 'Enregistrer les modifications' : 'Ajouter'}</button>
        <Link className="plai-btn-ghost btn-lien" to={modif ? `/o/${normaliserCode(codeUrl)}` : '/'}>Annuler</Link>
      </div>
    </form>
  );
}
