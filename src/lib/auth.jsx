import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { lireErreurLien } from '../domain/authurl.js';
import { queryClient } from './queryClient.js';

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

  // Dernière personne vue dans cet onglet. Supabase prévient aussi des connexions et déconnexions faites dans les autres onglets.
  const dernier = useRef(null);
  const suivre = (s) => {
    const id = s?.user?.id ?? null;
    // Les données en mémoire sont celles de la personne précédente : on ne les montre jamais à une autre.
    if (dernier.current && (id === null || id !== dernier.current)) queryClient.clear();
    if (id) dernier.current = id;
    setSession(s);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) dernier.current = data.session.user.id;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => suivre(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session, ready, erreurLien }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
