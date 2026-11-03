import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const ctx = vi.hoisted(() => ({ role: 'gestionnaire', updateUser: vi.fn() }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: { auth: { updateUser: (...a) => ctx.updateUser(...a) } } }));
vi.mock('../../src/lib/auth.jsx', () => ({ useAuth: () => ({ session: { user: { id: 'u1', email: 'jean.dupont@ecole.be' } }, ready: true }) }));
vi.mock('../../src/lib/org.jsx', () => ({ useOrg: () => ({ role: ctx.role, orgId: 'o1', orgNom: 'École A', memberships: [] }) }));
import Compte from '../../src/pages/Compte.jsx';

const monter = () => render(<MemoryRouter><Compte /></MemoryRouter>);
const saisir = (nouveau, confirmation = nouveau) => {
  fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/), { target: { value: nouveau } });
  fireEvent.change(screen.getByLabelText(/Confirmez le mot de passe/), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon mot de passe' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  ctx.role = 'gestionnaire';
  ctx.updateUser.mockResolvedValue({ error: null });
});

describe('Mon compte : mot de passe', () => {
  it('un administrateur ou un gestionnaire voit le formulaire, avec des champs masqués', () => {
    for (const role of ['admin', 'gestionnaire']) {
      ctx.role = role;
      const { unmount } = monter();
      expect(screen.getByLabelText(/Nouveau mot de passe/)).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText(/Nouveau mot de passe/)).toHaveAttribute('autocomplete', 'new-password');
      expect(screen.getByLabelText(/Confirmez le mot de passe/)).toHaveAttribute('type', 'password');
      unmount();
    }
  });
  it('un enseignant ou le rôle lecture ne voit pas le formulaire', () => {
    for (const role of ['emprunteur', 'lecture']) {
      ctx.role = role;
      const { unmount } = monter();
      expect(screen.getByText(/réservé aux administrateurs et aux gestionnaires/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Nouveau mot de passe/)).not.toBeInTheDocument();
      unmount();
    }
  });
  it('refuse un mot de passe trop court sans appeler Supabase', async () => {
    monter();
    saisir('court');
    expect(await screen.findByRole('alert')).toHaveTextContent('12');
    expect(ctx.updateUser).not.toHaveBeenCalled();
  });
  it('refuse deux mots de passe différents', async () => {
    monter();
    saisir('phrase de passe longue', 'phrase de passe longue!');
    expect(await screen.findByRole('alert')).toHaveTextContent(/identiques/);
    expect(ctx.updateUser).not.toHaveBeenCalled();
  });
  it('enregistre le mot de passe, confirme, et vide les champs', async () => {
    monter();
    saisir('phrase de passe longue');
    await waitFor(() => expect(ctx.updateUser).toHaveBeenCalledWith({ password: 'phrase de passe longue' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Mot de passe enregistré/);
    expect(screen.getByLabelText(/Nouveau mot de passe/)).toHaveValue('');
    expect(screen.getByLabelText(/Confirmez le mot de passe/)).toHaveValue('');
  });
  it('traduit le refus de Supabase sans détail technique', async () => {
    ctx.updateUser.mockResolvedValue({ error: { code: 'same_password', message: 'New password should be different' } });
    monter();
    saisir('phrase de passe longue');
    expect(await screen.findByRole('alert')).toHaveTextContent(/déjà le vôtre/);
    expect(screen.queryByText(/New password should/)).not.toBeInTheDocument();
  });
  it('prévient que le compte est commun aux outils du Pôle', () => {
    monter();
    expect(screen.getByText(/même adresse e-mail/)).toBeInTheDocument();
  });
});
