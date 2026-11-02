import { useQuery } from '@tanstack/react-query';
import { urlsPhotos } from '../../data/objets.js';
import { dateIso } from '../../domain/echeance.js';

const date = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-BE', { dateStyle: 'long' });
// Défense en profondeur : la base refuse déjà tout lien qui n'est pas http(s).
const sur = (url) => /^https?:\/\/\S+$/i.test(url ?? '');

export default function BlocAchat({ objet }) {
  const liens = (objet.liens ?? []).filter((l) => sur(l.url));
  const aAchat = objet.date_achat || objet.fournisseur || objet.prix_achat != null || objet.garantie_fin || objet.numero_serie || objet.facture_url || objet.facture_photo_path || objet.financement;
  const photoQ = useQuery({
    queryKey: ['photo', objet.facture_photo_path], enabled: !!objet.facture_photo_path,
    queryFn: async () => (await urlsPhotos([objet.facture_photo_path]))[objet.facture_photo_path],
  });
  if (!aAchat && liens.length === 0) return null;
  const garantieValable = objet.garantie_fin && objet.garantie_fin >= dateIso(new Date());

  return (
    <>
      {aAchat && (
        <section className="plai-card bloc">
          <h2>Achat</h2>
          <dl className="definitions">
            {objet.date_achat && <><dt>Acheté le</dt><dd>{date(objet.date_achat)}</dd></>}
            {objet.fournisseur && <><dt>Fournisseur</dt><dd>{objet.fournisseur}</dd></>}
            {objet.prix_achat != null && <><dt>Prix</dt><dd>{Number(objet.prix_achat).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' })}</dd></>}
            {objet.financement && <><dt>Financement</dt><dd>{objet.financement}</dd></>}
            {objet.numero_serie && <><dt>Numéro de série</dt><dd className="code-court">{objet.numero_serie}</dd></>}
            {objet.garantie_fin && (
              <><dt>Garantie</dt><dd>{garantieValable ? `Valable jusqu'au ${date(objet.garantie_fin)}` : `Terminée le ${date(objet.garantie_fin)}`}</dd></>
            )}
            {sur(objet.facture_url) && <><dt>Facture</dt><dd><a href={objet.facture_url} target="_blank" rel="noopener noreferrer">Ouvrir la facture</a></dd></>}
          </dl>
          {photoQ.data && <p><a href={photoQ.data} target="_blank" rel="noopener noreferrer">Voir la photo de la facture</a></p>}
        </section>
      )}
      {liens.length > 0 && (
        <section className="plai-card bloc">
          <h2>Liens utiles</h2>
          <ul className="liste-liens">
            {liens.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.titre}</a></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
