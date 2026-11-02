// Tests de pages avec une couche de données simulée : détectent les erreurs d'exécution et
// vérifient ce que chaque rôle voit. Ils ne remplacent pas un essai avec la vraie base.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ctx = vi.hoisted(() => ({ role: 'gestionnaire', userId: 'u1', donnees: {}, appels: {} }));

vi.mock('../../src/lib/supabase.js', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('../../src/lib/auth.jsx', () => ({ useAuth: () => ({ session: { user: { id: ctx.userId } }, ready: true }) }));
vi.mock('../../src/lib/org.jsx', () => ({
  useOrg: () => ({
    memberships: [{ orgId: 'o1', role: ctx.role, organisation: { id: 'o1', nom: 'École A', type: 'ecole' } }],
    orgId: 'o1', orgNom: 'École A', role: ctx.role, choisir: () => {},
  }),
}));
vi.mock('../../src/data/objets.js', () => ({
  listerObjets: async () => ctx.donnees.objets,
  getObjetParCode: async (code) => ctx.donnees.objets.find((o) => o.code === code) ?? null,
  listerHistorique: async () => ctx.donnees.historique ?? [],
  urlsPhotos: async () => ({}),
  modifierObjet: vi.fn(async () => {}),
  supprimerObjet: vi.fn(async () => {}),
  ajouterEntreeHistorique: vi.fn(async () => {}),
  creerObjets: vi.fn(async (_org, lot) => lot.map((l, i) => ({ objet_id: `n${i}`, objet_code: l.code }))),
  uploaderPhoto: vi.fn(async () => 'o1/x.jpg'),
  supprimerPhoto: vi.fn(async () => {}),
}));
vi.mock('../../src/data/prets.js', () => ({
  listerPrets: vi.fn(async (_o, opts) => ctx.donnees.prets.filter((p) => !opts?.ouverts || !p.retour_le)),
  listerReservations: async () => ctx.donnees.reservations ?? [],
  listerEmprunteurs: async () => ctx.donnees.emprunteurs ?? [],
  creerEmprunteur: vi.fn(async (_o, type, libelle) => ({ id: 'e-new', type, libelle, compte_id: null })),
  emprunter: vi.fn(async () => 'g'), preter: vi.fn(async () => 'g'), rendre: vi.fn(async () => {}), prolonger: vi.fn(async () => {}),
  signaler: vi.fn(async () => {}), reparer: vi.fn(async () => {}), ajusterStock: vi.fn(async () => 7),
  reserver: vi.fn(async () => 'r'), annulerReservation: vi.fn(async () => {}),
}));
vi.mock('../../src/data/referentiels.js', () => ({
  listerReferentiel: async (t) => (t === 'logi_categories' ? [{ id: 'c1', nom: 'Tablettes' }] : [{ id: 'e1', nom: 'Salle 12', parent_id: null }, { id: 'e2', nom: 'Armoire A', parent_id: 'e1' }]),
  ajouterReferentiel: vi.fn(), renommerReferentiel: vi.fn(), supprimerReferentiel: vi.fn(),
}));
vi.mock('../../src/data/membres.js', () => ({
  listerMembres: async () => [{ user_id: 'u1', email: 'admin@ecole.be', role: 'admin', cree_le: '2026-01-01' }],
  changerRole: vi.fn(), retirerMembre: vi.fn(),
  inviterMembres: vi.fn(async ({ emails }) => ({ ok: true, resultats: emails.map((e) => ({ email: e, ok: e !== 'mauvais@ecole.be', ...(e === 'mauvais@ecole.be' ? { erreur: 'Adresse invalide' } : {}) })), ajoutes: emails.length - 1, echecs: 1 })),
}));
vi.mock('../../src/data/importer.js', () => ({
  lireFichierImport: vi.fn(async () => [['nom', 'catégorie', 'quantité'], ['Loupe', 'Tablettes', '3'], ['', 'Tablettes', '1']]),
  executerImport: vi.fn(async () => ({ crees: 3 })),
}));

import * as objetsApi from '../../src/data/objets.js';
import * as pretsApi from '../../src/data/prets.js';
import * as membresApi from '../../src/data/membres.js';
import * as importerApi from '../../src/data/importer.js';
import Accueil from '../../src/pages/Accueil.jsx';
import FicheObjet from '../../src/pages/FicheObjet.jsx';
import FormulaireObjet from '../../src/pages/FormulaireObjet.jsx';
import MesEmprunts from '../../src/pages/MesEmprunts.jsx';
import Suivi from '../../src/pages/Suivi.jsx';
import AdminMembres from '../../src/pages/AdminMembres.jsx';
import Import from '../../src/pages/Import.jsx';
import Nav from '../../src/components/Nav.jsx';

const base = { org_id: 'o1', etat: 'bon', parent_id: null, consommable: false, notes: null, photo_path: null, categorie_id: 'c1', emplacement_id: 'e1',
  logi_categories: { nom: 'Tablettes' }, logi_emplacements: { nom: 'Salle 12' }, liens: [], quantite: null, seuil_min: null };
const K = { ...base, id: 'K', nom: 'Valise de tablettes', code: 'KKKK2222', date_achat: '2026-09-15', fournisseur: 'Fournisseur X', prix_achat: 4800,
  garantie_fin: '2099-01-01', liens: [{ titre: 'Notice', url: 'https://exemple.be/n' }, { titre: 'Piège', url: 'javascript:alert(1)' }] };
const T1 = { ...base, id: 'T1', nom: 'Tablette 1', code: 'TTTT2224', parent_id: 'K' };
const T2 = { ...base, id: 'T2', nom: 'Tablette 2', code: 'TTTT2225', parent_id: 'K', etat: 'defectueux' };
const P = { ...base, id: 'P', nom: 'Projecteur', code: 'PPPP2222' };
const C = { ...base, id: 'C', nom: 'Piles AA', code: 'CCCC2222', consommable: true, quantite: 4, seuil_min: 5 };
const emp = { libelle: 'prof@ecole.be', type: 'enseignant', compte_id: 'u1' };
const pret = (id, o, echeance = '2099-12-31') => ({ id, org_id: 'o1', objet_id: o.id, groupe_id: 'g1', emprunteur_id: 'e-u1', echeance, retour_le: null,
  logi_emprunteurs: emp, logi_objets: { nom: o.nom, code: o.code, parent_id: o.parent_id } });

function monter(ui, chemin = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[chemin]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
const fiche = (code) => monter(<Routes><Route path="/o/:code" element={<FicheObjet />} /></Routes>, `/o/${code}`);

beforeEach(() => {
  vi.clearAllMocks();
  ctx.role = 'gestionnaire';
  ctx.userId = 'u1';
  ctx.donnees = { objets: [K, T1, T2, P, C], prets: [], reservations: [], emprunteurs: [], historique: [] };
});

describe('Accueil', () => {
  it('montre les objets de premier niveau, pas les éléments de kit, et signale retards et stock bas', async () => {
    ctx.donnees.prets = [pret('p1', P, '2000-01-01')];
    monter(<Accueil />);
    expect(await screen.findByText('Valise de tablettes')).toBeInTheDocument();
    expect(screen.queryByText('Tablette 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Prêté à prof@ecole.be/)).toBeInTheDocument();
    expect(screen.getAllByText('En retard').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 prêt en retard/)).toBeInTheDocument();
    expect(screen.getByText(/1 consommable à racheter/)).toBeInTheDocument();
    expect(screen.getByText('4 en stock', { exact: false })).toBeInTheDocument();
  });
  it('retrouve un élément de kit quand on cherche', async () => {
    monter(<Accueil />);
    await screen.findByText('Valise de tablettes');
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'tablette 1' } });
    expect(await screen.findByText('Tablette 1')).toBeInTheDocument();
  });
});

describe('Fiche : prêt', () => {
  it('gestionnaire : prête un kit à un nouvel emprunteur anonyme', async () => {
    fiche('KKKK2222');
    expect(await screen.findByText('Disponible.')).toBeInTheDocument();
    expect(await screen.findByText(/Kit de 2 éléments/)).toBeInTheDocument();
    expect(screen.getByText(/Ne seront pas prêtés \(hors service ou déjà prêtés\) : Tablette 2/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Initiales, code ou nom/), { target: { value: 'M.D.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le prêt' }));
    await waitFor(() => expect(pretsApi.preter).toHaveBeenCalled());
    expect(pretsApi.creerEmprunteur).toHaveBeenCalledWith('o1', 'enseignant', 'M.D.');
    expect(pretsApi.preter.mock.calls[0].slice(0, 2)).toEqual(['K', 'e-new']);
    expect(pretsApi.preter.mock.calls[0][2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('gestionnaire : refuse de prêter sans emprunteur et le dit', async () => {
    fiche('PPPP2222');
    await screen.findByText('Disponible.');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le prêt' }));
    expect(await screen.findByText(/Choisissez un emprunteur/)).toBeInTheDocument();
    expect(pretsApi.preter).not.toHaveBeenCalled();
  });
  it('enseignant : emprunte pour lui-même, ne voit ni prêt à un tiers ni modification', async () => {
    ctx.role = 'emprunteur';
    fiche('PPPP2222');
    await screen.findByText('Disponible.');
    expect(screen.queryByRole('button', { name: 'Enregistrer le prêt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Modifier la fiche')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Emprunter pour moi' }));
    await waitFor(() => expect(pretsApi.emprunter).toHaveBeenCalledWith('P', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), null));
  });
  it('enseignant titulaire : voit l\'échéance, rend seulement les éléments cochés', async () => {
    ctx.role = 'emprunteur';
    ctx.donnees.prets = [pret('p1', K), pret('p2', T1)];
    fiche('KKKK2222');
    expect(await screen.findByText(/Prêté à prof@ecole.be/)).toBeInTheDocument();
    expect(screen.getByText(/À rendre le/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Tablette 1 \(TTTT-2224\)/)); // décoche : il manque, le code distingue les exemplaires
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le retour' }));
    await waitFor(() => expect(pretsApi.rendre).toHaveBeenCalledWith(['p1'], 'bon', null));
  });
  it('autre enseignant : ne peut ni rendre ni prolonger le prêt d\'un collègue', async () => {
    ctx.role = 'emprunteur';
    ctx.userId = 'u2';
    ctx.donnees.prets = [pret('p1', P)];
    fiche('PPPP2222');
    await screen.findByText(/Prêté à prof@ecole.be/);
    expect(screen.queryByRole('button', { name: 'Enregistrer le retour' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prolonger' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emprunter pour moi' })).not.toBeInTheDocument();
  });
  it('retard affiché avec le nombre de jours', async () => {
    ctx.role = 'gestionnaire';
    ctx.donnees.prets = [pret('p1', P, '2000-01-01')];
    fiche('PPPP2222');
    expect(await screen.findByText(/En retard de \d+ jours/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le retour' })).toBeInTheDocument();
  });
});

describe('Fiche : retour d’un kit', () => {
  it('liste le kit en premier puis ses éléments, même si la base les renvoie dans le désordre', async () => {
    ctx.role = 'emprunteur';
    ctx.donnees.prets = [pret('p2', T1), pret('p1', K)];
    fiche('KKKK2222');
    await screen.findByText(/Prêté à prof@ecole.be/);
    const noms = screen.getAllByRole('checkbox').map((c) => c.closest('label').textContent);
    expect(noms[0]).toMatch(/^Valise de tablettes/);
    expect(noms[1]).toMatch(/^Tablette 1/);
  });
  it('confirme l’emprunt avec une date lisible, pas en AAAA-MM-JJ', async () => {
    ctx.role = 'emprunteur';
    fiche('PPPP2222');
    await screen.findByText('Disponible.');
    fireEvent.click(screen.getByRole('button', { name: 'Emprunter pour moi' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Emprunt enregistré : à rendre le [a-zéû]+ \d{1,2} [a-zéû]+\./);
  });
});

describe('Fiche : volume de données', () => {
  it('ne charge que les prêts ouverts (sinon, après un an, les prêts récents seraient coupés par la limite de lignes)', async () => {
    fiche('PPPP2222');
    await screen.findByText('Disponible.');
    expect(pretsApi.listerPrets).toHaveBeenCalled();
    for (const appel of pretsApi.listerPrets.mock.calls) expect(appel[1]).toEqual({ ouverts: true });
  });
});

describe('Suivi : kit revenu incomplet', () => {
  it('garde visible la tablette non rendue quand la valise est déjà revenue', async () => {
    ctx.donnees.prets = [{ ...pret('p2', T1, '2000-01-01'), groupe_id: 'g1' }];
    monter(<Suivi />);
    expect(await screen.findByText(/Élément non rendu du kit/)).toBeInTheDocument();
    expect(screen.getByText('Tablette 1', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/TTTT-2224/)).toBeInTheDocument();
  });
});

describe('Fiche : réservations, pannes, stock, achat', () => {
  it('réserve un créneau valide et refuse un créneau incohérent sans appeler la base', async () => {
    ctx.role = 'emprunteur';
    fiche('PPPP2222');
    await screen.findByText('Réservations');
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '2099-01-02T10:00' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2099-01-02T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Réserver' }));
    expect(await screen.findByText(/fin doit être après/i)).toBeInTheDocument();
    expect(pretsApi.reserver).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2099-01-02T12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Réserver' }));
    await waitFor(() => expect(pretsApi.reserver).toHaveBeenCalled());
    expect(pretsApi.reserver.mock.calls[0][0]).toBe('P');
  });
  it('un enseignant signale une panne ; un objet défectueux ne se prête plus', async () => {
    ctx.role = 'emprunteur';
    fiche('PPPP2222');
    await screen.findByText('Signaler un problème');
    fireEvent.change(screen.getByLabelText(/Ce qui ne va pas/), { target: { value: 'écran noir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }));
    await waitFor(() => expect(pretsApi.signaler).toHaveBeenCalledWith('P', 'écran noir'));
  });
  it('objet défectueux : pas d\'emprunt, réparation proposée au gestionnaire', async () => {
    ctx.donnees.objets = [{ ...P, etat: 'defectueux' }];
    fiche('PPPP2222');
    expect(await screen.findByText(/hors service ou sorti/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer le prêt' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marquer réparé' }));
    await waitFor(() => expect(pretsApi.reparer).toHaveBeenCalledWith('P', null));
  });
  it('consommable : stock, alerte sous le seuil, mouvement négatif', async () => {
    fiche('CCCC2222');
    expect(await screen.findByText('4 en stock')).toBeInTheDocument();
    expect(screen.getByText(/Sous le seuil/)).toBeInTheDocument();
    expect(screen.queryByText('Prêt')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Variation du stock/), { target: { value: '-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mouvement' }));
    await waitFor(() => expect(pretsApi.ajusterStock).toHaveBeenCalledWith('C', -3, null));
  });
  it('refuse une variation de stock qui n\'est pas un entier', async () => {
    fiche('CCCC2222');
    await screen.findByText('4 en stock');
    fireEvent.change(screen.getByLabelText(/Variation du stock/), { target: { value: '2,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mouvement' }));
    expect(await screen.findByText(/nombre entier/)).toBeInTheDocument();
    expect(pretsApi.ajusterStock).not.toHaveBeenCalled();
  });
  it('achat et liens : affichés, et un lien dangereux n\'est jamais rendu cliquable', async () => {
    fiche('KKKK2222');
    expect(await screen.findByText('Fournisseur X')).toBeInTheDocument();
    expect(screen.getByText(/Valable jusqu'au/)).toBeInTheDocument();
    const notice = screen.getByRole('link', { name: 'Notice' });
    expect(notice).toHaveAttribute('href', 'https://exemple.be/n');
    expect(notice).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'Piège' })).not.toBeInTheDocument();
  });
  it('kit : un élément renvoie à son kit', async () => {
    fiche('TTTT2224');
    expect(await screen.findByText(/Fait partie du kit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer le prêt' })).not.toBeInTheDocument();
  });
});

describe('Emplacements : le chemin complet partout', () => {
  it('le formulaire propose « Salle 12 › Armoire A » et pas seulement « Armoire A »', async () => {
    monter(<Routes><Route path="/nouveau" element={<FormulaireObjet mode="creer" />} /></Routes>, '/nouveau');
    const select = await screen.findByLabelText('Emplacement');
    await waitFor(() => expect([...select.options].map((o) => o.textContent)).toContain('Salle 12 › Armoire A'));
    expect([...select.options].map((o) => o.textContent)).not.toContain('Armoire A');
  });
});

describe('Formulaire', () => {
  const formulaire = () => monter(<Routes><Route path="/nouveau" element={<FormulaireObjet mode="creer" />} /></Routes>, '/nouveau');
  it('refuse un lot invalide avant tout appel réseau', async () => {
    formulaire();
    fireEvent.change(await screen.findByLabelText(/Nom de l'objet/), { target: { value: 'Tablette' } });
    fireEvent.change(screen.getByLabelText(/Catégorie/), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/Nombre d'exemplaires/), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText(/entre 1 et 100/)).toBeInTheDocument();
    expect(objetsApi.creerObjets).not.toHaveBeenCalled();
  });
  it('envoie achat, liens et kit dans la création', async () => {
    formulaire();
    fireEvent.change(await screen.findByLabelText(/Nom de l'objet/), { target: { value: 'Tablette' } });
    fireEvent.change(screen.getByLabelText(/Catégorie/), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/Nombre d'exemplaires/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Prix payé (en euros)'), { target: { value: '299,00' } });
    fireEvent.change(screen.getByLabelText('Date d\'achat'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Un lien par ligne'), { target: { value: 'Notice | https://exemple.be/n' } });
    fireEvent.change(screen.getByLabelText('Fait partie du kit'), { target: { value: 'K' } });
    fireEvent.change(screen.getByLabelText('Emplacement'), { target: { value: 'e1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    expect(objetsApi.creerObjets.mock.calls[0][1].every((l) => l.emplacement_id === 'e1')).toBe(true);
    const lot = objetsApi.creerObjets.mock.calls[0][1];
    expect(lot).toHaveLength(2);
    expect(new Set(lot.map((l) => l.code)).size).toBe(2);
    expect(lot.map((l) => l.nom)).toEqual(['Tablette 1', 'Tablette 2']);
    expect(lot[0]).toMatchObject({ prix_achat: 299, date_achat: '2026-09-15', parent_id: 'K', consommable: false, liens: [{ titre: 'Notice', url: 'https://exemple.be/n' }] });
  });
  it('refuse un lien dangereux et une garantie avant l\'achat', async () => {
    formulaire();
    fireEvent.change(await screen.findByLabelText(/Nom de l'objet/), { target: { value: 'Tablette' } });
    fireEvent.change(screen.getByLabelText(/Catégorie/), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('Un lien par ligne'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText(/adresse invalide/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Un lien par ligne'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Date d\'achat'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Fin de garantie'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/garantie/i);
    expect(objetsApi.creerObjets).not.toHaveBeenCalled();
  });
  it('consommable : exige la quantité en stock et envoie le seuil', async () => {
    formulaire();
    fireEvent.change(await screen.findByLabelText(/Nom de l'objet/), { target: { value: 'Piles AA' } });
    fireEvent.change(screen.getByLabelText(/Catégorie/), { target: { value: 'c1' } });
    fireEvent.click(screen.getByLabelText(/C'est un consommable/));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/quantité en stock/i);
    fireEvent.change(screen.getByLabelText(/Quantité en stock/), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Seuil minimum'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    expect(objetsApi.creerObjets.mock.calls[0][1]).toHaveLength(1);
    expect(objetsApi.creerObjets.mock.calls[0][1][0]).toMatchObject({ consommable: true, quantite: 24, seuil_min: 6, parent_id: null });
  });
  it('un enseignant n\'accède pas au formulaire', async () => {
    ctx.role = 'emprunteur';
    formulaire();
    expect(await screen.findByText(/ne permet pas/)).toBeInTheDocument();
  });
});

describe('Mes emprunts et Suivi', () => {
  it('Mes emprunts : regroupe le kit, signale le retard, ignore les prêts des autres', async () => {
    ctx.role = 'emprunteur';
    const autre = { ...pret('p9', P), emprunteur_id: 'e-x', logi_emprunteurs: { libelle: 'autre', compte_id: 'u9' } };
    ctx.donnees.prets = [pret('p1', K, '2000-01-01'), pret('p2', T1, '2000-01-01'), autre];
    monter(<MesEmprunts />);
    expect(await screen.findByText('Valise de tablettes')).toBeInTheDocument();
    expect(screen.getByText(/avec 1 élément/)).toBeInTheDocument();
    expect(screen.getByText(/En retard de/)).toBeInTheDocument();
    expect(screen.queryByText('Projecteur')).not.toBeInTheDocument();
  });
  it('Mes emprunts : message vide clair', async () => {
    ctx.role = 'emprunteur';
    monter(<MesEmprunts />);
    expect(await screen.findByText(/rien emprunté/)).toBeInTheDocument();
  });
  it('Suivi : prêts en retard en premier, à réparer, stock à racheter', async () => {
    ctx.donnees.prets = [pret('p1', P, '2099-01-01'), { ...pret('p3', K, '2000-01-01'), groupe_id: 'g3' }];
    monter(<Suivi />);
    expect(await screen.findByText(/2 prêts en cours/)).toBeInTheDocument();
    expect(screen.getByText(/1 en retard/)).toBeInTheDocument();
    const liste = screen.getAllByRole('link').map((l) => l.textContent);
    expect(liste.findIndex((t) => t.includes('Valise'))).toBeLessThan(liste.findIndex((t) => t.includes('Projecteur')));
    expect(screen.getByText('Tablette 2')).toBeInTheDocument(); // défectueux
    expect(screen.getByText('Piles AA')).toBeInTheDocument();
  });
  it('Suivi : un enseignant est renvoyé vers Mes emprunts', async () => {
    ctx.role = 'emprunteur';
    monter(<Suivi />);
    expect(await screen.findByText(/réservé aux gestionnaires/)).toBeInTheDocument();
  });
});

describe('Navigation', () => {
  it('un enseignant ne voit ni Suivi, ni Ajouter, ni Administration', () => {
    ctx.role = 'emprunteur';
    monter(<Nav />);
    expect(screen.getByRole('link', { name: 'Mes emprunts' })).toBeInTheDocument();
    for (const nom of ['Suivi', 'Ajouter', 'Administration', 'Étiquettes']) expect(screen.queryByRole('link', { name: nom })).not.toBeInTheDocument();
  });
  it('un administrateur voit tout', () => {
    ctx.role = 'admin';
    monter(<Nav />);
    for (const nom of ['Matériel', 'Scanner', 'Mes emprunts', 'Suivi', 'Étiquettes', 'Ajouter', 'Administration']) expect(screen.getByRole('link', { name: nom })).toBeInTheDocument();
  });
});

describe('Administration', () => {
  it('invitation en lot : lit une colonne collée, envoie la liste et rapporte les échecs', async () => {
    ctx.role = 'admin';
    monter(<AdminMembres />);
    fireEvent.change(await screen.findByLabelText(/Adresses e-mail à inviter/), { target: { value: 'a@ecole.be\r\nb@ecole.be\nmauvais@ecole.be' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inviter' }));
    await waitFor(() => expect(membresApi.inviterMembres).toHaveBeenCalledWith({ orgId: 'o1', emails: ['a@ecole.be', 'b@ecole.be', 'mauvais@ecole.be'], role: 'emprunteur' }));
    expect(await screen.findByText(/mauvais@ecole.be : Adresse invalide/)).toBeInTheDocument();
    expect(screen.getByText(/2 personnes ajoutées, 1 en échec/)).toBeInTheDocument();
    expect(screen.getByText(/pas encore de compte reçoivent un e-mail/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresses e-mail à inviter/).value).toBe('mauvais@ecole.be');
  });
  it('import : analyse, montre les erreurs de ligne, puis importe sur confirmation', async () => {
    ctx.role = 'admin';
    monter(<Import />);
    const fichier = new File(['x'], 'inventaire.csv', { type: 'text/csv' });
    fireEvent.change(await screen.findByLabelText(/Fichier à importer/), { target: { files: [fichier] } });
    fireEvent.click(screen.getByRole('button', { name: 'Analyser le fichier' }));
    expect(await screen.findByText(/1 ligne valide/)).toBeInTheDocument();
    expect(screen.getByText(/3 objets à créer/)).toBeInTheDocument();
    expect(screen.getByText('Le nom est obligatoire.')).toBeInTheDocument();
    expect(importerApi.executerImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Importer 3 objets' }));
    await waitFor(() => expect(importerApi.executerImport).toHaveBeenCalled());
    expect(await screen.findByText(/3 objets importés/)).toBeInTheDocument();
  });
});
