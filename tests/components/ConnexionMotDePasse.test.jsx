import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ signInWithOtp: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: { auth: mocks } }));
vi.mock('../../src/lib/auth.jsx', () => ({ useAuth: () => ({ session: null, ready: true, erreurLien: null }) }));
import Connexion from '../../src/pages/Connexion.jsx';

const monter = () => render(<MemoryRouter><Connexion /></MemoryRouter>);
const onglet = (nom) => fireEvent.click(screen.getByRole('tab', { name: nom }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
});

describe('Connexion : lien e-mail ou mot de passe', () => {
  it('propose le lien e-mail par défaut (enseignants : pas de mot de passe à retenir)', () => {
    monter();
    expect(screen.getByRole('tab', { name: 'Par lien e-mail' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Recevoir mon lien de connexion' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Votre mot de passe/)).not.toBeInTheDocument();
  });
  it('se connecte avec l\'adresse (nettoyée) et le mot de passe tel quel', async () => {
    monter();
    onglet('Avec mon mot de passe');
    fireEvent.change(screen.getByLabelText(/Votre adresse e-mail/), { target: { value: ' Jean.Dupont@Ecole.be ' } });
    fireEvent.change(screen.getByLabelText(/Votre mot de passe/), { target: { value: ' Phrase de passe ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Me connecter' }));
    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'jean.dupont@ecole.be', password: ' Phrase de passe ' }));
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
  it('le champ mot de passe est masqué et ne déclenche pas l\'enregistrement par le navigateur d\'un mauvais champ', () => {
    monter();
    onglet('Avec mon mot de passe');
    const champ = screen.getByLabelText(/Votre mot de passe/);
    expect(champ).toHaveAttribute('type', 'password');
    expect(champ).toHaveAttribute('autocomplete', 'current-password');
  });
  it('affiche un message sans dire quel champ est faux, et oriente vers le lien e-mail', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } });
    monter();
    onglet('Avec mon mot de passe');
    fireEvent.change(screen.getByLabelText(/Votre adresse e-mail/), { target: { value: 'a@ecole.be' } });
    fireEvent.change(screen.getByLabelText(/Votre mot de passe/), { target: { value: 'faux' } });
    fireEvent.click(screen.getByRole('button', { name: 'Me connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Adresse ou mot de passe incorrect.*lien/s);
    expect(screen.queryByText(/Invalid login/)).not.toBeInTheDocument();
  });
  it('garde l\'adresse saisie quand on change d\'onglet', () => {
    monter();
    fireEvent.change(screen.getByLabelText(/Votre adresse e-mail/), { target: { value: 'a@ecole.be' } });
    onglet('Avec mon mot de passe');
    expect(screen.getByLabelText(/Votre adresse e-mail/)).toHaveValue('a@ecole.be');
  });
  it('retient le dernier mode choisi pour la prochaine visite', () => {
    const { unmount } = monter();
    onglet('Avec mon mot de passe');
    unmount();
    monter();
    expect(screen.getByRole('tab', { name: 'Avec mon mot de passe' })).toHaveAttribute('aria-selected', 'true');
  });
  it('fonctionne même si le stockage du navigateur est indisponible', () => {
    const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué'); });
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqué'); });
    monter();
    onglet('Avec mon mot de passe');
    expect(screen.getByLabelText(/Votre mot de passe/)).toBeInTheDocument();
    lire.mockRestore();
    ecrire.mockRestore();
  });
  it('explique comment obtenir un mot de passe', () => {
    monter();
    onglet('Avec mon mot de passe');
    expect(screen.getByText(/créez-le dans « Mon compte »/)).toBeInTheDocument();
  });
  it('un échec de connexion par lien affiche toujours le message du lien (non-régression)', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit' } });
    monter();
    fireEvent.change(screen.getByLabelText(/Votre adresse e-mail/), { target: { value: 'a@ecole.be' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir mon lien de connexion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de demandes');
  });
});
