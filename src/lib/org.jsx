import { createContext, useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase.js';
import { useAuth } from './auth.jsx';
import { choisirOrganisationActive } from '../domain/organisation.js';

const OrgCtx = createContext(null);
const CLE = 'logi_org_active';

function lire() {
  try { return localStorage.getItem(CLE); } catch { return null; }
}
function ecrire(v) {
  try { localStorage.setItem(CLE, v); } catch { /* stockage indisponible : on continue sans */ }
}

export function OrgProvider({ children }) {
  const { session, ready } = useAuth();
  const [idChoisi, setIdChoisi] = useState(lire);

  const { data, isLoading, error } = useQuery({
    queryKey: ['memberships', session?.user?.id],
    enabled: ready && !!session,
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('logi_membres')
        .select('org_id, role, logi_organisations(id, nom, type)')
        .eq('user_id', session.user.id);
      if (err) throw err;
      return rows.map((m) => ({ orgId: m.org_id, role: m.role, organisation: m.logi_organisations }));
    },
  });

  const memberships = data ?? [];
  const active = choisirOrganisationActive(memberships, idChoisi);
  const choisir = (id) => { setIdChoisi(id); ecrire(id); };

  const value = {
    memberships,
    active,
    role: active?.role ?? null,
    orgId: active?.orgId ?? null,
    orgNom: active?.organisation?.nom ?? '',
    choisir,
    loading: !ready || (!!session && isLoading),
    error,
  };
  return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgCtx);
  if (!ctx) throw new Error('useOrg hors OrgProvider');
  return ctx;
}
