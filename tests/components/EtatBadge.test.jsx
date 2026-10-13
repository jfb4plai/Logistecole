import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EtatBadge from '../../src/components/EtatBadge.jsx';

describe('EtatBadge', () => {
  it('affiche toujours un mot, pas seulement une couleur', () => {
    render(<EtatBadge etat="defectueux" />);
    expect(screen.getByText('Défectueux')).toBeInTheDocument();
  });
});
