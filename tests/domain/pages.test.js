import { describe, it, expect } from 'vitest';
import { lireToutesLesPages } from '../../src/data/pages.js';

const faux = (total) => async (de, a) => Array.from({ length: Math.max(0, Math.min(a, total - 1) - de + 1) }, (_, i) => de + i);

describe('lireToutesLesPages (la base plafonne chaque réponse à 1000 lignes)', () => {
  it('assemble toutes les pages', async () => {
    const r = await lireToutesLesPages(faux(2500));
    expect(r).toHaveLength(2500);
    expect(r[0]).toBe(0);
    expect(r[2499]).toBe(2499);
  });
  it('arrête la lecture quand une page est incomplète, y compris quand elle tombe pile', async () => {
    expect(await lireToutesLesPages(faux(1000))).toHaveLength(1000);
    expect(await lireToutesLesPages(faux(0))).toEqual([]);
    expect(await lireToutesLesPages(faux(3))).toHaveLength(3);
  });
  it('plafonne pour ne jamais boucler indéfiniment', async () => {
    const toujours = async (de, a) => Array.from({ length: a - de + 1 }, () => 1);
    const r = await lireToutesLesPages(toujours, { max: 3000 });
    expect(r).toHaveLength(3000);
  });
});
