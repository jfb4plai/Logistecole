import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { lireErreurLien } from '../domain/authurl.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  // Lu avant toute redirection (qui effacerait l'adresse), puis l'adresse est nettoyée.
  const [erreurLien] = useState(() => {
    const e = lireErreurLien(window.location.hash) ?? lireErreurLien(window.location.search);
    if (e) window.history.replaceState(null, '', window.location.pathname);
    return e;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session, ready, erreurLien }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
