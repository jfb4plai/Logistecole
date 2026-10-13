import { describe, it, expect } from 'vitest';
import { choisirOrganisationActive } from '../../src/domain/organisation.js';
import { peutEcrire, estAdmin } from '../../src/domain/permissions.js';

const m = (id, role = 'gestionnaire') => ({ orgId: id, role, organisation: { id, nom: `Org ${id}`, type: 'ecole' } });

describe('choisirOrganisationActive (revue focus 3)', () => {
  it('renvoie null quand le compte n\'a aucune organisation', () => {
    expect(choisirOrganisationActive([], null)).toBeNull();
    expect(choisirOrganisationActive([], 'x')).toBeNull();
    expect(choisirOrganisationActive(undefined, null)).toBeNull();
  });
  it('reprend l\'organisation mémorisée si elle existe encore', () => {
    expect(choisirOrganisationActive([m('a'), m('b')], 'b').orgId).toBe('b');
  });
  it('retombe sur la première si la mémorisée n\'existe plus', () => {
    expect(choisirOrganisationActive([m('a'), m('b')], 'zzz').orgId).toBe('a');
  });
});

describe('permissions', () => {
  it('seuls admin et gestionnaire écrivent', () => {
    expect(peutEcrire('admin')).toBe(true);
    expect(peutEcrire('gestionnaire')).toBe(true);
    expect(peutEcrire('lecture')).toBe(false);
    expect(peutEcrire(null)).toBe(false);
  });
  it('seul admin administre', () => {
    expect(estAdmin('admin')).toBe(true);
    expect(estAdmin('gestionnaire')).toBe(false);
  });
});
