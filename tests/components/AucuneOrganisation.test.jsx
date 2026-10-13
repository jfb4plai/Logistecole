import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AucuneOrganisation from '../../src/pages/AucuneOrganisation.jsx';

describe('AucuneOrganisation (revue focus 3)', () => {
  it('explique la situation et donne un contact', () => {
    render(<AucuneOrganisation />);
    expect(screen.getByText(/pas encore rattaché/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /jf\.beguin@outlook\.com/ })).toHaveAttribute('href', 'mailto:jf.beguin@outlook.com');
  });
});
