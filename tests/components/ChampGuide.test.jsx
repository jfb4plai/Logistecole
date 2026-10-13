import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChampGuide from '../../src/components/ChampGuide.jsx';

describe('ChampGuide', () => {
  it('relie label, champ et texte d\'aide', () => {
    render(
      <ChampGuide id="nom" label="Nom de l'objet" aide="Apparaît sur l'étiquette." obligatoire>
        <input id="nom" aria-describedby="nom-aide" />
      </ChampGuide>
    );
    const champ = screen.getByLabelText(/Nom de l'objet/);
    expect(champ).toHaveAttribute('aria-describedby', 'nom-aide');
    expect(screen.getByText('Apparaît sur l\'étiquette.')).toHaveAttribute('id', 'nom-aide');
  });
});
