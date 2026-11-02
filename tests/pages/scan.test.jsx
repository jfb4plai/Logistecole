// Scan : la saisie à la main doit toujours dire pourquoi un code est refusé, caméra ou non.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const cam = vi.hoisted(() => ({ ok: false }));
vi.mock('qr-scanner', () => ({
  default: class {
    start() { return cam.ok ? Promise.resolve() : Promise.reject(new Error('refusée')); }
    stop() {}
    destroy() {}
  },
}));

import Scan from '../../src/pages/Scan.jsx';

async function saisir(code) {
  render(<MemoryRouter><Scan /></MemoryRouter>);
  if (!cam.ok) await screen.findByText(/caméra est indisponible/); // l'état de JF : caméra refusée
  fireEvent.change(screen.getByLabelText(/saisissez le code/i), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la fiche' }));
}

describe('Scan : code saisi invalide', () => {
  it('sans caméra : affiche le message d’erreur (constaté absent par JF avec « ABCD123 »)', async () => {
    cam.ok = false;
    await saisir('ABCD123');
    await waitFor(() => expect(screen.getByText(/n.est pas valide/)).toBeInTheDocument());
  });
  it('avec caméra : affiche le message une seule fois', async () => {
    cam.ok = true;
    await saisir('ABCD123');
    await waitFor(() => expect(screen.getAllByText(/n.est pas valide/)).toHaveLength(1));
  });
});
