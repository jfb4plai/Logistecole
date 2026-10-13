import { useQuery } from '@tanstack/react-query';
import { listerObjets, urlsPhotos } from './objets.js';
import { listerReferentiel } from './referentiels.js';

export const useObjets = (orgId) =>
  useQuery({ queryKey: ['objets', orgId], enabled: !!orgId, queryFn: () => listerObjets(orgId) });

export const useCategories = (orgId) =>
  useQuery({ queryKey: ['categories', orgId], enabled: !!orgId, queryFn: () => listerReferentiel('logi_categories', orgId) });

export const useEmplacements = (orgId) =>
  useQuery({ queryKey: ['emplacements', orgId], enabled: !!orgId, queryFn: () => listerReferentiel('logi_emplacements', orgId) });

export function usePhotos(objets) {
  const paths = [...new Set((objets ?? []).map((o) => o.photo_path).filter(Boolean))].sort();
  const { data } = useQuery({
    queryKey: ['photos', paths.join('|')],
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: () => urlsPhotos(paths),
  });
  return data ?? {};
}
