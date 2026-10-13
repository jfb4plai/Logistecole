import { ETATS } from '../domain/etats.js';

export default function EtatBadge({ etat }) {
  const e = ETATS.find((x) => x.value === etat);
  return <span className={`badge-etat badge-${e?.ton ?? 'neutre'}`}>{e?.label ?? etat}</span>;
}
