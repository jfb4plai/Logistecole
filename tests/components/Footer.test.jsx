import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../../src/components/Footer.jsx';

describe('Footer', () => {
  it('donne l\'adresse scolaire de contact (outil strictement scolaire), pas l\'adresse grand public', () => {
    render(<Footer />);
    const lien = screen.getByRole('link', { name: 'jeanfrancois.beguin@ens.ecl.be' });
    expect(lien).toHaveAttribute('href', 'mailto:jeanfrancois.beguin@ens.ecl.be');
    expect(screen.queryByText(/outlook/i)).not.toBeInTheDocument();
  });
});
