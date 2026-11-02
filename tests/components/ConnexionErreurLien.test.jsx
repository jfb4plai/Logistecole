import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/lib/supabase.js', () => ({ supabase: { auth: { signInWithOtp: vi.fn() } } }));
vi.mock('../../src/lib/auth.jsx', () => ({
  useAuth: () => ({ session: null, ready: true, erreurLien: { code: 'otp_expired', message: 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.' } }),
}));
import Connexion from '../../src/pages/Connexion.jsx';

describe('Connexion après un lien qui a échoué', () => {
  it('affiche pourquoi, au lieu de montrer la page de connexion sans explication', () => {
    render(<MemoryRouter><Connexion /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent(/expiré ou a déjà été utilisé/);
  });
});
