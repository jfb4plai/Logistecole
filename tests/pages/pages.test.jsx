// Tests de pages avec une couche de données simulée : détectent les erreurs d'exécution et
// vérifient ce que chaque rôle voit. Ils ne remplacent pas un essai avec la vraie base.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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
vi.mock('../../src/data/criteres.js', () => ({
  listerCriteres: vi.fn(async () => ctx.donnees.criteres ?? []),
  listerCatalogueAmenagements: vi.fn(async () => {
    if (ctx.donnees.catalogueErreur) throw new Error('réseau');
    return ctx.donnees.catalogue ?? { chapitres: [], amenagements: [] };
  }),
  definirCriteres: vi.fn(async () => {}),
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
vi.mock('../../src/data/journal.js', () => ({
  listerJournal: vi.fn(async (_org, apres) => (apres ? [] : ctx.donnees.journal ?? [])),
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
import * as criteresApi from '../../src/data/criteres.js';
import Accueil from '../../src/pages/Accueil.jsx';
import FicheObjet from '../../src/pages/FicheObjet.jsx';
import FormulaireObjet from '../../src/pages/FormulaireObjet.jsx';
import MesEmprunts from '../../src/pages/MesEmprunts.jsx';
import Suivi from '../../src/pages/Suivi.jsx';
import AdminMembres from '../../src/pages/AdminMembres.jsx';
import Import from '../../src/pages/Import.jsx';
import Nav from '../../src/components/Nav.jsx';
import Journal from '../../src/pages/Journal.jsx';
import Etiquettes from '../../src/pages/Etiquettes.jsx';
import * as journalApi from '../../src/data/journal.js';

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
    await waitFor(() => expect(pretsApi.rendre).toHaveBeenCalledWith([{ pret: 'p1', etat: 'bon', commentaire: null }], null));
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

describe('Fiche : état au retour, objet par objet', () => {
  const T1neuf = { ...T1, etat: 'neuf' };
  beforeEach(() => {
    ctx.role = 'emprunteur';
    ctx.donnees.objets = [K, T1neuf, T2, P, C];
    ctx.donnees.prets = [pret('p1', K), pret('p2', T1neuf)];
  });
  it('propose par défaut l’état au départ de chaque élément, « Neuf » compris, et envoie un seul retour', async () => {
    fiche('KKKK2222');
    await screen.findByText(/Prêté à prof@ecole.be/);
    expect(screen.getByLabelText(/État de Valise de tablettes/)).toHaveValue('bon');
    expect(screen.getByLabelText(/État de Tablette 1/)).toHaveValue('neuf');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le retour' }));
    await waitFor(() => expect(pretsApi.rendre).toHaveBeenCalledTimes(1));
    expect(pretsApi.rendre.mock.calls[0][0]).toEqual([
      { pret: 'p1', etat: 'bon', commentaire: null },
      { pret: 'p2', etat: 'neuf', commentaire: null },
    ]);
  });
  it('ne propose jamais un état meilleur que l’état actuel (pas « Neuf » pour un objet en bon état)', async () => {
    fiche('KKKK2222');
    await screen.findByText(/Prêté à prof@ecole.be/);
    const options = (nom) => [...screen.getByLabelText(nom).options].map((o) => o.textContent);
    expect(options(/État de Valise de tablettes/)).toEqual(['Bon état', 'Usé', 'Défectueux', 'Perdu']);
    expect(options(/État de Tablette 1/)).toEqual(['Neuf', 'Bon état', 'Usé', 'Défectueux', 'Perdu']);
  });
  it('un état et une remarque par élément, dans un seul appel : la remarque ne se copie pas sur les autres', async () => {
    fiche('KKKK2222');
    await screen.findByText(/Prêté à prof@ecole.be/);
    fireEvent.change(screen.getByLabelText(/État de Tablette 1/), { target: { value: 'defectueux' } });
    fireEvent.change(screen.getByLabelText(/Remarque pour Tablette 1/), { target: { value: 'écran fissuré' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le retour' }));
    await waitFor(() => expect(pretsApi.rendre).toHaveBeenCalledTimes(1));
    expect(pretsApi.rendre.mock.calls[0][0]).toEqual([
      { pret: 'p1', etat: 'bon', commentaire: null },
      { pret: 'p2', etat: 'defectueux', commentaire: 'écran fissuré' },
    ]);
  });
  it('un objet seul : un seul choix d’état, sans case à cocher', async () => {
    ctx.donnees.prets = [pret('p1', P)];
    fiche('PPPP2222');
    await screen.findByText(/Prêté à prof@ecole.be/);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByLabelText(/État au retour/)).toHaveValue('bon');
    fireEvent.change(screen.getByLabelText(/Remarque au retour/), { target: { value: 'tout est en ordre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le retour' }));
    await waitFor(() => expect(pretsApi.rendre).toHaveBeenCalledWith([{ pret: 'p1', etat: 'bon', commentaire: 'tout est en ordre' }], null));
  });
});

describe('Journal de l’organisation', () => {
  const evt = (id, type, jour, extra = {}) => ({ id, type, quand: `${jour}T10:00:00`, avant: null, apres: null, commentaire: null, auteur_email: 'jf@ecole.be', logi_objets: { nom: 'Valise de tablettes', code: 'KKKK2222' }, ...extra });
  beforeEach(() => {
    const auj = new Date().toISOString().slice(0, 10);
    ctx.donnees.journal = [
      evt(3, 'pret', auj, { apres: 'M.D.', commentaire: 'jusqu’au 09/11/2026' }),
      evt(2, 'panne', auj, { commentaire: 'écran noir', logi_objets: { nom: 'Projecteur', code: 'PPPP2222' } }),
      evt(1, 'creation', '2026-10-01', { apres: 'Valise de tablettes' }),
    ];
  });
  it('liste les événements de tous les objets, regroupés par jour, avec un lien vers la fiche', async () => {
    monter(<Journal />);
    expect(await screen.findByText('Aujourd’hui')).toBeInTheDocument();
    expect(screen.getByText(/Prêté à M.D./)).toBeInTheDocument();
    expect(screen.getByText(/Problème signalé : écran noir/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projecteur' })).toHaveAttribute('href', '/o/PPPP2222');
  });
  it('filtre par catégorie et par recherche', async () => {
    monter(<Journal />);
    await screen.findByText(/Prêté à M.D./);
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'pannes' } });
    expect(screen.queryByText(/Prêté à M.D./)).not.toBeInTheDocument();
    expect(screen.getByText(/Problème signalé/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'projecteur' } });
    expect(screen.queryByText(/Prêté à M.D./)).not.toBeInTheDocument();
    expect(screen.getByText(/Problème signalé/)).toBeInTheDocument();
  });
  it('message clair quand il n’y a rien', async () => {
    ctx.donnees.journal = [];
    monter(<Journal />);
    expect(await screen.findByText(/Aucun événement/)).toBeInTheDocument();
  });
  it('réservé aux gestionnaires : un enseignant est renvoyé vers Mes emprunts', async () => {
    ctx.role = 'emprunteur';
    monter(<Journal />);
    expect(await screen.findByText(/réservé aux gestionnaires/)).toBeInTheDocument();
    expect(journalApi.listerJournal).not.toHaveBeenCalled();
  });
  it('« Charger plus » apparaît quand la page est pleine', async () => {
    ctx.donnees.journal = Array.from({ length: 200 }, (_, i) => evt(500 - i, 'note', '2026-10-02', { commentaire: `n${i}` }));
    monter(<Journal />);
    fireEvent.click(await screen.findByRole('button', { name: /Charger plus/ }));
    await waitFor(() => expect(journalApi.listerJournal).toHaveBeenLastCalledWith('o1', 301));
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

describe('Champs de date : année limitée à 4 chiffres', () => {
  it('les champs de réservation ont un minimum et un maximum', async () => {
    ctx.role = 'emprunteur';
    fiche('PPPP2222');
    await screen.findByText('Réservations');
    for (const nom of ['Début', 'Fin']) {
      const champ = screen.getByLabelText(nom);
      expect(champ.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(champ.getAttribute('max')).toBe('2099-12-31T23:59');
    }
  });
  it('les dates d’achat et de garantie du formulaire sont bornées aussi', async () => {
    monter(<Routes><Route path="/nouveau" element={<FormulaireObjet mode="creer" />} /></Routes>, '/nouveau');
    const achat = await screen.findByLabelText("Date d'achat");
    const garantie = screen.getByLabelText('Fin de garantie');
    expect(achat.getAttribute('max')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(garantie.getAttribute('max')).toBe('2099-12-31');
    expect(garantie.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
    for (const nom of ['Suivi', 'Journal', 'Ajouter', 'Administration', 'Étiquettes']) expect(screen.queryByRole('link', { name: nom })).not.toBeInTheDocument();
  });
  it('un administrateur voit tout', () => {
    ctx.role = 'admin';
    monter(<Nav />);
    for (const nom of ['Matériel', 'Scanner', 'Mes emprunts', 'Suivi', 'Journal', 'Étiquettes', 'Ajouter', 'Administration']) expect(screen.getByRole('link', { name: nom })).toBeInTheDocument();
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

describe('Formulaire : fiche enrichie', () => {
  const CRITERES = [
    { id: 'k1', famille: 'trouble', libelle: 'Dyslexie', aide: 'a', ordre: 1 },
    { id: 'k2', famille: 'difficulte', libelle: 'Lecture', aide: 'b', ordre: 1 },
  ];
  const CATALOGUE = {
    chapitres: [{ id: 'ch1', ordre: 1, titre: '1. SUPPORTS ET DOCUMENTS', est_dispositif: false }],
    amenagements: [{ id: 'am1', chapitre_id: 'ch1', ordre: 1, libelle: 'Police lisible', type: 'AU', actif: true }],
  };
  const Etat = () => <p data-testid="avert">{useLocation().state?.avertissement ?? 'aucun'}</p>;
  const creation = () => monter(
    <Routes><Route path="/nouveau" element={<FormulaireObjet mode="creer" />} /><Route path="/o/:code" element={<Etat />} /></Routes>, '/nouveau');
  const modification = (code) => monter(
    <Routes><Route path="/o/:code/modifier" element={<FormulaireObjet mode="modifier" />} /><Route path="/o/:code" element={<Etat />} /></Routes>, `/o/${code}/modifier`);
  const remplir = async (nom = 'Les neurones de la lecture') => {
    fireEvent.change(await screen.findByLabelText(/Nom de l'objet/), { target: { value: nom } });
    fireEvent.change(screen.getByLabelText(/Catégorie/), { target: { value: 'c1' } });
  };
  const ajouter = () => fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  const cocherTrouble = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /Troubles concernés/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dyslexie' }));
  };

  beforeEach(() => {
    ctx.donnees.criteres = CRITERES;
    ctx.donnees.catalogue = CATALOGUE;
  });

  it("normalise l'ISBN en 13 chiffres et envoie auteur, éditeur, description et type", async () => {
    creation();
    await remplir();
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '2-7381-1974-3' } });
    fireEvent.change(screen.getByLabelText('Auteur'), { target: { value: 'Stanislas Dehaene' } });
    fireEvent.change(screen.getByLabelText('Éditeur'), { target: { value: 'Odile Jacob' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' Livre de référence. ' } });
    ajouter();
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    expect(objetsApi.creerObjets.mock.calls[0][1][0]).toMatchObject({
      isbn: '9782738119742', auteur: 'Stanislas Dehaene', editeur: 'Odile Jacob', description: 'Livre de référence.',
      type_ressource: 'physique', autre_trouble: null, autre_difficulte: null, autre_amenagement: null,
    });
  });
  it('refuse un ISBN invalide avant tout appel réseau', async () => {
    creation();
    await remplir();
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '123' } });
    ajouter();
    expect(await screen.findByRole('alert')).toHaveTextContent(/ISBN/);
    expect(objetsApi.creerObjets).not.toHaveBeenCalled();
  });
  it('refuse « Autre » coché sans texte', async () => {
    creation();
    await remplir();
    fireEvent.click(await screen.findByRole('button', { name: /Troubles concernés/ }));
    fireEvent.click(within(screen.getByRole('group', { name: /Troubles concernés/ })).getByRole('checkbox', { name: 'Autre (préciser)' }));
    ajouter();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Autre/);
    expect(objetsApi.creerObjets).not.toHaveBeenCalled();
  });
  it("n'enregistre pas le texte d'un « Autre » décoché", async () => {
    creation();
    await remplir();
    fireEvent.click(await screen.findByRole('button', { name: /Troubles concernés/ }));
    fireEvent.click(within(screen.getByRole('group', { name: /Troubles concernés/ })).getByRole('checkbox', { name: 'Autre (préciser)' }));
    fireEvent.change(screen.getByLabelText(/Précisez « Autre »/), { target: { value: 'texte tapé' } });
    fireEvent.click(within(screen.getByRole('group', { name: /Troubles concernés/ })).getByRole('checkbox', { name: 'Autre (préciser)' }));
    ajouter();
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    expect(objetsApi.creerObjets.mock.calls[0][1][0].autre_trouble).toBeNull();
  });
  it('envoie « Autre » rempli', async () => {
    creation();
    await remplir();
    fireEvent.click(await screen.findByRole('button', { name: /Troubles concernés/ }));
    fireEvent.click(within(screen.getByRole('group', { name: /Troubles concernés/ })).getByRole('checkbox', { name: 'Autre (préciser)' }));
    fireEvent.change(screen.getByLabelText(/Précisez « Autre »/), { target: { value: ' élèves allophones ' } });
    ajouter();
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    expect(objetsApi.creerObjets.mock.calls[0][1][0].autre_trouble).toBe('élèves allophones');
  });
  it("pose les critères sur l'objet créé", async () => {
    creation();
    await remplir();
    await cocherTrouble();
    ajouter();
    await waitFor(() => expect(criteresApi.definirCriteres).toHaveBeenCalledWith('n0', { critereIds: ['k1'], chapitreIds: [], amenagementIds: [] }));
  });
  it("n'appelle pas definirCriteres quand aucun critère n'est posé", async () => {
    creation();
    await remplir();
    await screen.findByRole('button', { name: /Troubles concernés/ });
    ajouter();
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    expect(criteresApi.definirCriteres).not.toHaveBeenCalled();
  });
  it("si les critères échouent après la création, navigue quand même avec un avertissement", async () => {
    criteresApi.definirCriteres.mockRejectedValueOnce(new Error('boom'));
    creation();
    await remplir();
    await cocherTrouble();
    ajouter();
    expect(await screen.findByTestId('avert')).toHaveTextContent(/créé mais les critères n'ont pas pu être enregistrés/);
    expect(objetsApi.creerObjets).toHaveBeenCalledTimes(1);
    expect(objetsApi.supprimerPhoto).not.toHaveBeenCalled();
  });
  it('objet numérique : ni quantité, ni consommable, ni kit ; un seul objet sans parent', async () => {
    creation();
    await remplir('Site de calcul mental');
    fireEvent.change(screen.getByLabelText('Type de ressource'), { target: { value: 'numerique' } });
    expect(screen.queryByLabelText(/Nombre d'exemplaires/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/C'est un consommable/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fait partie du kit')).not.toBeInTheDocument();
    ajouter();
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    const lot = objetsApi.creerObjets.mock.calls[0][1];
    expect(lot).toHaveLength(1);
    expect(lot[0]).toMatchObject({ type_ressource: 'numerique', consommable: false, parent_id: null, etat: 'bon', nom: 'Site de calcul mental' });
  });
  it('un consommable coché puis un passage en numérique ne laisse pas de consommable', async () => {
    creation();
    await remplir('Piles');
    fireEvent.click(screen.getByLabelText(/C'est un consommable/));
    fireEvent.change(screen.getByLabelText('Type de ressource'), { target: { value: 'numerique' } });
    ajouter();
    await waitFor(() => expect(objetsApi.creerObjets).toHaveBeenCalled());
    expect(objetsApi.creerObjets.mock.calls[0][1][0]).toMatchObject({ consommable: false, quantite: null });
  });

  it("modification sans toucher au bloc : n'appelle pas definirCriteres", async () => {
    modification('PPPP2222');
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => expect(objetsApi.modifierObjet).toHaveBeenCalled());
    expect(criteresApi.definirCriteres).not.toHaveBeenCalled();
  });
  it('modification en touchant au bloc : appelle definirCriteres avant modifierObjet', async () => {
    ctx.donnees.objets = [{ ...P, critere_ids: ['k2'], chapitre_ids: [], amenagement_ids: [] }];
    modification('PPPP2222');
    await screen.findByLabelText(/Nom de l'objet/);
    await cocherTrouble();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => expect(criteresApi.definirCriteres).toHaveBeenCalledWith('P', { critereIds: ['k2', 'k1'], chapitreIds: [], amenagementIds: [] }));
    await waitFor(() => expect(objetsApi.modifierObjet).toHaveBeenCalled());
    expect(criteresApi.definirCriteres.mock.invocationCallOrder[0]).toBeLessThan(objetsApi.modifierObjet.mock.invocationCallOrder[0]);
  });
  it("catalogue illisible : la fiche s'enregistre et aucun critère existant n'est effacé", async () => {
    ctx.donnees.catalogueErreur = true;
    ctx.donnees.objets = [{ ...P, critere_ids: ['k1'], chapitre_ids: ['ch1'], amenagement_ids: [], autre_trouble: 'élèves allophones' }];
    modification('PPPP2222');
    expect(await screen.findByText(/Les listes n'ont pas pu être chargées/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => expect(objetsApi.modifierObjet).toHaveBeenCalled());
    expect(criteresApi.definirCriteres).not.toHaveBeenCalled();
    expect(objetsApi.modifierObjet.mock.calls[0][1].autre_trouble).toBe('élèves allophones');
  });
});

describe('Fiche : fiche enrichie', () => {
  const CRITERES = [
    { id: 'k1', famille: 'trouble', libelle: 'Dyslexie', aide: 'a', ordre: 1 },
    { id: 'k2', famille: 'difficulte', libelle: 'Lecture', aide: 'b', ordre: 1 },
  ];
  const CATALOGUE = {
    chapitres: [
      { id: 'ch1', ordre: 1, titre: '1. SUPPORTS ET DOCUMENTS', est_dispositif: false },
      { id: 'ch2', ordre: 2, titre: 'Dispositif de régulation', est_dispositif: true },
    ],
    amenagements: [
      { id: 'am-old', chapitre_id: 'ch1', ordre: 9, libelle: 'Ancien aménagement', type: 'AR', actif: false },
      { id: 'am-contrat', chapitre_id: 'ch2', ordre: 1, libelle: 'Contrat de comportement', type: 'AR', actif: true },
    ],
  };
  const LIVRE = {
    ...P, type_ressource: 'physique', auteur: 'Stanislas Dehaene', editeur: 'Odile Jacob', isbn: '9782738119742', description: 'Livre de référence.',
    critere_ids: ['k1', 'k2'], chapitre_ids: ['ch2'], amenagement_ids: ['am-old'], autre_trouble: 'élèves allophones',
  };
  beforeEach(() => {
    ctx.donnees.criteres = CRITERES;
    ctx.donnees.catalogue = CATALOGUE;
  });

  it('montre notice, critères, chapitre, aménagement désactivé, « Autre » et la mention indicative', async () => {
    ctx.donnees.objets = [LIVRE];
    fiche('PPPP2222');
    expect(await screen.findByText('Stanislas Dehaene')).toBeInTheDocument();
    expect(screen.getByText('Odile Jacob')).toBeInTheDocument();
    expect(screen.getByText('9782738119742')).toBeInTheDocument();
    expect(screen.getByText('Livre de référence.')).toBeInTheDocument();
    expect(await screen.findByText('Dyslexie')).toBeInTheDocument();
    expect(screen.getByText('Lecture')).toBeInTheDocument();
    expect(screen.getByText(/Dispositif de régulation/)).toBeInTheDocument();
    expect(screen.getByText(/Ancien aménagement/)).toBeInTheDocument();
    expect(screen.getByText(/désactivé dans AménagActif/)).toBeInTheDocument();
    expect(screen.getByText('élèves allophones')).toBeInTheDocument();
    expect(screen.getByText('Étiquettes indicatives posées par l\'équipe, pas une prescription.')).toBeInTheDocument();
  });
  it('un objet ancien, sans les nouveaux champs, s\'affiche sans erreur', async () => {
    fiche('PPPP2222');
    expect(await screen.findByText('Aucun critère posé.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projecteur' })).toBeInTheDocument();
  });
  it('si les listes sont illisibles, ne prétend pas qu\'il n\'y a aucun critère', async () => {
    ctx.donnees.catalogueErreur = true;
    ctx.donnees.objets = [LIVRE];
    fiche('PPPP2222');
    expect(await screen.findByText(/liste indisponible/i)).toBeInTheDocument();
    expect(screen.queryByText('Aucun critère posé.')).not.toBeInTheDocument();
  });
  it('un objet numérique n\'offre ni prêt, ni réservation, ni étiquette', async () => {
    ctx.donnees.objets = [{ ...P, id: 'N', code: 'NNNN2222', nom: 'Site de calcul', type_ressource: 'numerique' }];
    fiche('NNNN2222');
    expect(await screen.findByRole('heading', { name: 'Site de calcul' })).toBeInTheDocument();
    expect(screen.getByText('Modifier la fiche')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emprunter pour moi' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Imprimer l'étiquette/)).not.toBeInTheDocument();
  });
  it('un objet physique garde l\'étiquette et le prêt (témoin)', async () => {
    fiche('PPPP2222');
    expect(await screen.findByText(/Imprimer l'étiquette/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emprunter pour moi' })).toBeInTheDocument();
  });
  it('un enseignant voit les critères mais aucun lien de modification', async () => {
    ctx.role = 'emprunteur';
    ctx.donnees.objets = [LIVRE];
    fiche('PPPP2222');
    expect(await screen.findByText('Dyslexie')).toBeInTheDocument();
    expect(screen.queryByText('Modifier la fiche')).not.toBeInTheDocument();
  });
  it('affiche l\'avertissement transmis après une création', async () => {
    monter(<Routes><Route path="/o/:code" element={<FicheObjet />} /></Routes>,
      { pathname: '/o/PPPP2222', state: { avertissement: 'Les critères sont à ajouter.' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Les critères sont à ajouter.');
  });
});

describe('Étiquettes : objets numériques', () => {
  it('ne propose pas un objet numérique', async () => {
    ctx.donnees.objets = [P, { ...base, id: 'N', nom: 'Site de lecture', code: 'NNNN2222', type_ressource: 'numerique' }];
    monter(<Etiquettes />, '/etiquettes');
    expect(await screen.findByText('Projecteur')).toBeInTheDocument();
    expect(screen.queryByText('Site de lecture')).not.toBeInTheDocument();
  });
});
