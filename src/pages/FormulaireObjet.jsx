import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import { creerObjets, modifierObjet, getObjetParCode, uploaderPhoto, supprimerPhoto } from '../data/objets.js';
import { useCategories, useEmplacements, useObjets } from '../data/hooks.js';
import { validerLot, nomsDuLot } from '../domain/lot.js';
import { genererCodes, normaliserCode } from '../domain/codes.js';
import { validerFichierPhoto, compresserImage } from '../domain/image.js';
import { validerAchat } from '../domain/achat.js';
import { analyserLiens, formaterLiens } from '../domain/liens.js';
import { elementsDuKit, racines } from '../domain/kit.js';
import { cheminsEmplacements } from '../domain/emplacements.js';
import { ETATS } from '../domain/etats.js';
import { peutEcrire } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

const VIDE = {
  nom: '', categorie_id: '', emplacement_id: '', etat: 'bon', notes: '', quantite: '1',
  date_achat: '', fournisseur: '', prix_achat: '', garantie_fin: '', numero_serie: '', facture_url: '', financement: '',
  liens: '', parent_id: '', consommable: false, stock: '', seuil_min: '', numeroter: true,
};

const entierOuNull = (v) => (String(v).trim() === '' ? null : Number(v));

export default function FormulaireObjet({ mode }) {
  const modif = mode === 'modifier';
  const { code: codeUrl } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { orgId, role } = useOrg();
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];
  const objets = useObjets(orgId).data ?? [];

  const existantQ = useQuery({
    queryKey: ['objet', normaliserCode(codeUrl)], enabled: modif && !!normaliserCode(codeUrl),
    queryFn: () => getObjetParCode(normaliserCode(codeUrl)),
  });
  const existant = existantQ.data;
  const [f, setF] = useState(VIDE);
  const [fichier, setFichier] = useState(null);
  const [facture, setFacture] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  useEffect(() => {
    if (modif && existant) {
      setF({
        ...VIDE,
        nom: existant.nom, categorie_id: existant.categorie_id ?? '', emplacement_id: existant.emplacement_id ?? '', etat: existant.etat, notes: existant.notes ?? '',
        date_achat: existant.date_achat ?? '', fournisseur: existant.fournisseur ?? '', prix_achat: existant.prix_achat ?? '', garantie_fin: existant.garantie_fin ?? '',
        numero_serie: existant.numero_serie ?? '', facture_url: existant.facture_url ?? '', financement: existant.financement ?? '',
        liens: formaterLiens(existant.liens), parent_id: existant.parent_id ?? '', consommable: existant.consommable, seuil_min: existant.seuil_min ?? '',
      });
    }
  }, [modif, existant]);

  if (!peutEcrire(role)) return <p className="plai-error" role="alert">Votre rôle ne permet pas d'ajouter ou de modifier du matériel.</p>;
  if (modif && existantQ.isLoading) return <p className="chargement">Chargement…</p>;
  if (modif && !existant) return <p className="plai-error" role="alert">Objet introuvable.</p>;
  if (cats.length === 0) {
    return (
      <div className="plai-card">
        <h1>Aucune catégorie</h1>
        <p>Une catégorie est nécessaire pour classer le matériel. Un administrateur peut en ajouter dans l'<Link to="/admin">administration</Link>.</p>
      </div>
    );
  }

  const aDesElements = modif && existant ? elementsDuKit(objets, existant.id).length > 0 : false;
  const kitsPossibles = racines(objets).filter((o) => !o.consommable && o.id !== existant?.id);

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    if (!f.categorie_id) { setErreur('Choisissez une catégorie.'); return; }
    const conso = !modif && f.consommable;
    const lot = validerLot({ nom: f.nom, quantite: modif || conso ? 1 : f.quantite, numeroter: f.numeroter });
    if (!lot.ok) { setErreur(lot.erreur); return; }
    const achat = validerAchat(f);
    if (!achat.ok) { setErreur(achat.erreurs.join(' ')); return; }
    const liens = analyserLiens(f.liens);
    if (liens.erreurs.length) { setErreur(liens.erreurs.join(' ')); return; }
    const seuil = entierOuNull(f.seuil_min);
    const stock = entierOuNull(f.stock);
    if (seuil !== null && (!Number.isInteger(seuil) || seuil < 0)) { setErreur('Le seuil minimum doit être un nombre entier positif ou nul.'); return; }
    if (conso && (stock === null || !Number.isInteger(stock) || stock < 0)) { setErreur('Indiquez la quantité en stock (nombre entier, zéro ou plus).'); return; }
    for (const [fic, nom] of [[fichier, 'photo'], [facture, 'photo de la facture']]) {
      if (fic) {
        const v = validerFichierPhoto(fic);
        if (!v.ok) { setErreur(`${nom[0].toUpperCase()}${nom.slice(1)} : ${v.erreur}`); return; }
      }
    }

    setEnvoi(true);
    const televerses = [];
    try {
      let photoPath = null;
      let facturePath = null;
      if (fichier) { photoPath = await uploaderPhoto(orgId, await compresserImage(fichier)); televerses.push(photoPath); }
      if (facture) { facturePath = await uploaderPhoto(orgId, await compresserImage(facture)); televerses.push(facturePath); }
      const commun = {
        nom: lot.nom,
        categorie_id: f.categorie_id,
        emplacement_id: f.emplacement_id || null,
        notes: f.notes.trim() || null,
        ...achat.valeurs,
        liens: liens.liens,
        parent_id: f.consommable ? null : (f.parent_id || null),
        seuil_min: f.consommable || (modif && existant?.consommable) ? seuil : null,
      };

      if (modif) {
        const champs = { ...commun };
        if (photoPath) champs.photo_path = photoPath;
        if (facturePath) champs.facture_photo_path = facturePath;
        await modifierObjet(existant.id, champs);
        qc.invalidateQueries({ queryKey: ['objet'] });
        qc.invalidateQueries({ queryKey: ['objets', orgId] });
        navigate(`/o/${existant.code}`);
        return;
      }

      // Collision de code improbable : jusqu'à 3 tentatives avec de nouveaux codes.
      let crees;
      for (let essai = 0; ; essai++) {
        const codes = genererCodes(lot.quantite);
        const noms = nomsDuLot(lot.nom, lot.quantite, f.numeroter);
        try {
          crees = await creerObjets(orgId, codes.map((code, i) => ({
            ...commun, nom: noms[i], etat: f.etat, photo_path: photoPath, facture_photo_path: facturePath, code,
            consommable: conso, quantite: conso ? stock : null,
          })));
          break;
        } catch (err) {
          if (err?.code !== '23505' || essai >= 2) throw err;
        }
      }
      qc.invalidateQueries({ queryKey: ['objets', orgId] });
      const codes = crees.map((c) => c.objet_code);
      navigate(codes.length === 1 ? `/o/${codes[0]}` : `/etiquettes?codes=${codes.join(',')}`);
    } catch (err) {
      for (const p of televerses) await supprimerPhoto(p);
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  const conso = modif ? existant?.consommable : f.consommable;

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
          {cheminsEmplacements(emps).map((e) => <option key={e.id} value={e.id}>{e.chemin}</option>)}
        </select>
      </ChampGuide>

      {!modif && (
        <>
          <ChampGuide id="etat" label="État à l'arrivée" aide="L'état de l'objet au moment où vous l'enregistrez. Il pourra changer ensuite et chaque changement est tracé.">
            <select id="etat" aria-describedby="etat-aide" className="plai-input" value={f.etat} onChange={maj('etat')}>
              {ETATS.filter((e) => e.value !== 'sorti').map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </ChampGuide>

          <div className="plai-field">
            <label className="liste-cases"><span><input type="checkbox" checked={f.consommable} onChange={maj('consommable')} /> C'est un consommable (papier, piles, cartouches…)</span></label>
            <p className="champ-aide">Un consommable se compte (entrées et sorties de stock) au lieu de se prêter. Une alerte signale quand il passe sous le seuil minimum.</p>
          </div>

          {!f.consommable ? (
            <>
              <ChampGuide id="quantite" label="Nombre d'exemplaires identiques" obligatoire aide="Pour 16 tablettes identiques, tapez 16 : chacune reçoit son propre code et sa propre étiquette. Entre 1 et 100 à la fois.">
                <input id="quantite" aria-describedby="quantite-aide" className="plai-input" inputMode="numeric" placeholder="Ex. : 16" value={f.quantite} onChange={maj('quantite')} />
              </ChampGuide>
              {Number(f.quantite) > 1 && (
                <div className="plai-field">
                  <label className="liste-cases"><span><input type="checkbox" checked={f.numeroter} onChange={maj('numeroter')} /> Numéroter les exemplaires ({f.nom.trim() || 'Tablette'} 1, {f.nom.trim() || 'Tablette'} 2…)</span></label>
                  <p className="champ-aide">Recommandé : au retour d'un kit, vous devez pouvoir dire quelle tablette manque. Décochez seulement pour des objets vraiment interchangeables.</p>
                </div>
              )}
            </>
          ) : (
            <ChampGuide id="stock" label="Quantité en stock" obligatoire aide="Combien vous en avez aujourd'hui. Les mouvements suivants se notent sur la fiche.">
              <input id="stock" aria-describedby="stock-aide" className="plai-input" inputMode="numeric" placeholder="Ex. : 24" value={f.stock} onChange={maj('stock')} />
            </ChampGuide>
          )}
        </>
      )}

      {conso && (
        <ChampGuide id="seuil" label="Seuil minimum" aide="Sous ce nombre (ou à ce nombre), le consommable apparaît dans « Suivi » comme « à racheter ». Laissez vide pour ne pas être alerté.">
          <input id="seuil" aria-describedby="seuil-aide" className="plai-input" inputMode="numeric" placeholder="Ex. : 6" value={f.seuil_min} onChange={maj('seuil_min')} />
        </ChampGuide>
      )}

      <ChampGuide id="photo" label="Photo" aide="Facultative. Elle est réduite automatiquement (environ 200 Ko) avant l'envoi. Avec plusieurs exemplaires, la même photo sert pour tous.">
        <input id="photo" aria-describedby="photo-aide" className="plai-input" type="file" accept="image/*" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
      </ChampGuide>

      <ChampGuide id="notes" label="Notes" aide="Tout ce qui aide à s'en servir ou à le retrouver : mot de passe du chariot, accessoires fournis. Pas de nom d'élève.">
        <textarea id="notes" aria-describedby="notes-aide" className="plai-input" rows={3} maxLength={2000} placeholder="Ex. : chargeurs dans le tiroir du bas, clé chez la secrétaire" value={f.notes} onChange={maj('notes')} />
      </ChampGuide>

      {!conso && (
        <details className="plai-card details-form">
          <summary>Kit (facultatif)</summary>
          <ChampGuide id="kit" label="Fait partie du kit" aide="Un kit se prête et se rend d'un bloc (par exemple une valise et ses tablettes). Choisissez l'objet principal : il doit exister déjà et ne pas être lui-même un élément. Un élément ne se prête pas seul.">
            <select id="kit" aria-describedby="kit-aide" className="plai-input" value={f.parent_id} disabled={aDesElements} onChange={maj('parent_id')}>
              <option value="">Aucun (objet seul ou objet principal)</option>
              {kitsPossibles.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
            {aDesElements && <p className="champ-aide">Cet objet contient déjà des éléments : il ne peut pas devenir lui-même un élément.</p>}
          </ChampGuide>
        </details>
      )}

      <details className="plai-card details-form">
        <summary>Achat et garantie (facultatif)</summary>
        <p className="champ-aide">Garde la mémoire de l'achat. Ce n'est pas de la comptabilité : rien n'est calculé.</p>
        <ChampGuide id="date_achat" label="Date d'achat" aide="Apparaît dans l'historique de l'objet.">
          <input id="date_achat" type="date" aria-describedby="date_achat-aide" className="plai-input" value={f.date_achat} onChange={maj('date_achat')} />
        </ChampGuide>
        <ChampGuide id="fournisseur" label="Fournisseur" aide="Où il a été acheté ou qui l'a donné.">
          <input id="fournisseur" aria-describedby="fournisseur-aide" className="plai-input" maxLength={120} placeholder="Ex. : Librairie scolaire de Liège" value={f.fournisseur} onChange={maj('fournisseur')} />
        </ChampGuide>
        <ChampGuide id="prix_achat" label="Prix payé (en euros)" aide="Pour un seul exemplaire. La virgule est acceptée.">
          <input id="prix_achat" aria-describedby="prix_achat-aide" className="plai-input" inputMode="decimal" placeholder="Ex. : 299,00" value={f.prix_achat} onChange={maj('prix_achat')} />
        </ChampGuide>
        <ChampGuide id="garantie_fin" label="Fin de garantie" aide="Permet de savoir si une réparation est encore couverte. Après la date d'achat.">
          <input id="garantie_fin" type="date" aria-describedby="garantie_fin-aide" className="plai-input" value={f.garantie_fin} onChange={maj('garantie_fin')} />
        </ChampGuide>
        <ChampGuide id="numero_serie" label="Numéro de série" aide="Utile pour une réparation ou en cas de vol. Il est le même pour tous les exemplaires d'un lot : modifiez-le ensuite fiche par fiche si besoin.">
          <input id="numero_serie" aria-describedby="numero_serie-aide" className="plai-input" maxLength={80} placeholder="Ex. : SN-4F8K2L19" value={f.numero_serie} onChange={maj('numero_serie')} />
        </ChampGuide>
        <ChampGuide id="financement" label="Origine du financement" aide="Qui a payé : le Pôle, le pouvoir organisateur, un subside, un don.">
          <input id="financement" aria-describedby="financement-aide" className="plai-input" maxLength={120} placeholder="Ex. : Budget du Pôle, rentrée 2026" value={f.financement} onChange={maj('financement')} />
        </ChampGuide>
        <ChampGuide id="facture_url" label="Lien vers la facture" aide="Une adresse http ou https (dossier partagé du Pôle ou de l'école). Pas de PDF envoyé ici : il ferait grossir le stockage.">
          <input id="facture_url" aria-describedby="facture_url-aide" className="plai-input" maxLength={500} placeholder="Ex. : https://exemple.be/factures/2026-09-15.pdf" value={f.facture_url} onChange={maj('facture_url')} />
        </ChampGuide>
        <ChampGuide id="facture" label="Photo de la facture" aide="Facultative : une photo compressée (environ 200 Ko) de la facture papier.">
          <input id="facture" aria-describedby="facture-aide" className="plai-input" type="file" accept="image/*" onChange={(e) => setFacture(e.target.files?.[0] ?? null)} />
        </ChampGuide>
      </details>

      <details className="plai-card details-form">
        <summary>Liens utiles (facultatif)</summary>
        <ChampGuide id="liens" label="Un lien par ligne" aide="Mode d'emploi, vidéo, fiche pédagogique : ils s'ouvrent depuis la fiche. Écrivez « titre | adresse », ou l'adresse seule. 10 liens au plus, http ou https seulement.">
          <textarea id="liens" aria-describedby="liens-aide" className="plai-input" rows={4}
            placeholder={'Mode d\'emploi | https://exemple.be/notice.pdf\nhttps://exemple.be/video'} value={f.liens} onChange={maj('liens')} />
        </ChampGuide>
      </details>

      <div className="actions">
        <button className="plai-btn" disabled={envoi}>{envoi ? 'Enregistrement…' : modif ? 'Enregistrer les modifications' : 'Ajouter'}</button>
        <Link className="plai-btn-ghost btn-lien" to={modif ? `/o/${normaliserCode(codeUrl)}` : '/'}>Annuler</Link>
      </div>
    </form>
  );
}
