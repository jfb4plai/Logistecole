import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({ rappel: null, desinscrire: vi.fn(), session: null }));
vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      onAuthStateChange: (cb) => { auth.rappel = cb; return { data: { subscription: { unsubscribe: auth.desinscrire } } }; },
    },
  },
}));
import { AuthProvider, useAuth } from '../../src/lib/auth.jsx';
import { queryClient } from '../../src/lib/queryClient.js';

const A = { user: { id: 'u-a' } };
const B = { user: { id: 'u-b' } };
function Sonde() {
  const { session, ready } = useAuth();
  return <p data-testid="etat">{ready ? (session?.user?.id ?? 'aucune session') : 'chargement'}</p>;
}
const monter = async (session) => {
  auth.session = session;
  render(<AuthProvider><Sonde /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('etat')).not.toHaveTextContent('chargement'));
};
const evenement = (nom, session) => act(() => { auth.rappel(nom, session); });

beforeEach(() => {
  vi.restoreAllMocks();
  auth.desinscrire.mockClear();
  queryClient.clear();
});

describe('AuthProvider : les autres onglets du navigateur', () => {
  it('une déconnexion dans un autre onglet déconnecte celui-ci', async () => {
    await monter(A);
    expect(screen.getByTestId('etat')).toHaveTextContent('u-a');
    evenement('SIGNED_OUT', null);
    expect(screen.getByTestId('etat')).toHaveTextContent('aucune session');
  });
  it('une connexion dans un autre onglet connecte celui-ci', async () => {
    await monter(null);
    evenement('SIGNED_IN', A);
    expect(screen.getByTestId('etat')).toHaveTextContent('u-a');
  });
  it('vide les données en mémoire quand la personne connectée change, pour ne jamais montrer celles de la précédente', async () => {
    const vider = vi.spyOn(queryClient, 'clear');
    await monter(A);
    queryClient.setQueryData(['objets', 'o1'], [{ id: 'secret' }]);
    evenement('SIGNED_OUT', null);
    expect(vider).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['objets', 'o1'])).toBeUndefined();
    queryClient.setQueryData(['objets', 'o1'], [{ id: 'secret' }]);
    evenement('SIGNED_IN', B);
    expect(vider).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(['objets', 'o1'])).toBeUndefined();
  });
  it('conserve les données quand la même personne se reconnaît (renouvellement du jeton, autre onglet)', async () => {
    const vider = vi.spyOn(queryClient, 'clear');
    await monter(A);
    queryClient.setQueryData(['objets', 'o1'], [{ id: 'garde' }]);
    evenement('TOKEN_REFRESHED', { user: { id: 'u-a' }, access_token: 'nouveau' });
    evenement('SIGNED_IN', { user: { id: 'u-a' } });
    expect(vider).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['objets', 'o1'])).toEqual([{ id: 'garde' }]);
  });
  it('ne vide rien à la première connexion de l\'onglet', async () => {
    const vider = vi.spyOn(queryClient, 'clear');
    await monter(null);
    evenement('SIGNED_IN', A);
    expect(vider).not.toHaveBeenCalled();
  });
  it('se désabonne à la fermeture', async () => {
    const { unmount } = render(<AuthProvider><Sonde /></AuthProvider>);
    unmount();
    expect(auth.desinscrire).toHaveBeenCalled();
  });
});
