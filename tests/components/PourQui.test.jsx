import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListeACocher from '../../src/components/ListeACocher.jsx';
import SelecteurAmenagements from '../../src/components/SelecteurAmenagements.jsx';
import PourQui from '../../src/components/PourQui.jsx';
import { organiserCatalogue, selectionVide } from '../../src/domain/amenagements.js';
import { autresVides, MENTION_INDICATIVE } from '../../src/domain/criteres.js';

const options = [
  { value: 'k1', label: 'Dyslexie', aide: 'Utile à des élèves concernés par : dyslexie. Étiquette indicative.' },
  { value: 'k2', label: 'TDAH' },
];
const vide = { coche: false, texte: '' };

function liste(props = {}) {
  const onChange = vi.fn();
  const onAutre = vi.fn();
  render(<ListeACocher id="tr" label="Troubles concernés" aide="Aide de la liste" options={options} valeurs={[]} onChange={onChange} autre={vide} onAutre={onAutre} {...props} />);
  return { onChange, onAutre };
}
const ouvrir = (nom) => fireEvent.click(screen.getByRole('button', { name: nom }));

describe('ListeACocher', () => {
  it('est fermée au départ et s\'ouvre au clic', () => {
    liste();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const bouton = screen.getByRole('button', { name: /Troubles concernés/ });
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('checkbox', { name: 'Dyslexie' })).toBeInTheDocument();
    expect(screen.getByText(/Utile à des élèves concernés par : dyslexie/)).toBeInTheDocument();
  });
  it('coche et décoche une option', () => {
    const { onChange } = liste({ valeurs: ['k2'] });
    ouvrir(/Troubles concernés/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dyslexie' }));
    expect(onChange).toHaveBeenLastCalledWith(['k2', 'k1']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'TDAH' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
  it('résume ce qui est coché sur le bouton fermé', () => {
    liste({ valeurs: ['k1', 'k2'] });
    expect(screen.getByRole('button', { name: /Dyslexie, TDAH \(2 cochés\)/ })).toBeInTheDocument();
  });
  it('« Autre » ouvre un champ texte et prévient le parent', () => {
    const { onAutre } = liste();
    ouvrir(/Troubles concernés/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Autre (préciser)' }));
    expect(onAutre).toHaveBeenCalledWith({ coche: true, texte: '' });
  });
  it('montre le champ de description quand « Autre » est coché, limité à 500 caractères', () => {
    const { onAutre } = liste({ autre: { coche: true, texte: '' }, placeholderAutre: 'Ex. : élèves allophones' });
    ouvrir(/Troubles concernés/);
    const champ = screen.getByLabelText(/Précisez « Autre »/);
    expect(champ).toHaveAttribute('maxlength', '500');
    expect(champ).toHaveAttribute('placeholder', 'Ex. : élèves allophones');
    fireEvent.change(champ, { target: { value: 'élèves allophones' } });
    expect(onAutre).toHaveBeenLastCalledWith({ coche: true, texte: 'élèves allophones' });
  });
  it('n\'affiche pas « Autre » en mode filtre', () => {
    liste({ sansAutre: true });
    ouvrir(/Troubles concernés/);
    expect(screen.queryByRole('checkbox', { name: 'Autre (préciser)' })).not.toBeInTheDocument();
  });
});

const catalogue = organiserCatalogue({
  chapitres: [
    { id: 'c1', ordre: 1, titre: '1. SUPPORTS ET DOCUMENTS', est_dispositif: false },
    { id: 'c2', ordre: 2, titre: 'Dispositif de régulation', est_dispositif: true },
  ],
  amenagements: [
    { id: 'a1', chapitre_id: 'c1', ordre: 1, libelle: 'Police lisible', type: 'AU', actif: true },
    { id: 'a2', chapitre_id: 'c1', ordre: 2, libelle: 'Temps supplémentaire', type: 'AR', actif: true },
    { id: 'a3', chapitre_id: 'c1', ordre: 3, libelle: 'Ancien aménagement', type: 'AR', actif: false },
    { id: 'a4', chapitre_id: 'c2', ordre: 1, libelle: 'Contrat de comportement', type: 'AR', actif: true },
  ],
}, { dejaChoisis: ['a3'] });

function selecteur(props = {}) {
  const onChange = vi.fn();
  const onAutre = vi.fn();
  render(<SelecteurAmenagements id="am" label="Aménagements" aide="Aide" catalogue={catalogue} selection={selectionVide()} onChange={onChange} autre={vide} onAutre={onAutre} {...props} />);
  return { onChange, onAutre };
}
const voirDetail = (i = 0) => fireEvent.click(screen.getAllByRole('button', { name: /voir le détail/i })[i]);

describe('SelecteurAmenagements', () => {
  it('liste les chapitres, détails fermés', () => {
    selecteur();
    expect(screen.getByRole('checkbox', { name: /1\. SUPPORTS ET DOCUMENTS/ })).toBeInTheDocument();
    expect(screen.queryByText('Police lisible')).not.toBeInTheDocument();
  });
  it('cocher un chapitre appelle onChange avec le chapitre choisi', () => {
    const { onChange } = selecteur({ selection: { chapitres: [], amenagements: ['a1'] } });
    fireEvent.click(screen.getByRole('checkbox', { name: /1\. SUPPORTS ET DOCUMENTS/ }));
    expect(onChange).toHaveBeenCalledWith({ chapitres: ['c1'], amenagements: [] });
  });
  it('chapitre entier : détails cochés, désactivés, résumé « chapitre entier »', () => {
    selecteur({ selection: { chapitres: ['c1'], amenagements: [] } });
    expect(screen.getByText('chapitre entier')).toBeInTheDocument();
    voirDetail(0);
    expect(screen.getByRole('checkbox', { name: /Police lisible/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Police lisible/ })).toBeChecked();
  });
  it('affiche « 1 sur 3 » pour un chapitre partiellement choisi', () => {
    selecteur({ selection: { chapitres: [], amenagements: ['a1'] } });
    expect(screen.getByText('1 sur 3')).toBeInTheDocument();
  });
  it('coche un détail et montre les étiquettes AU, AR et Dispositif', () => {
    const { onChange } = selecteur();
    voirDetail(0);
    voirDetail(0); // le premier bouton devient « Masquer » : le suivant prend la place
    expect(screen.getByRole('checkbox', { name: /AU.*Police lisible/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /AR.*Temps supplémentaire/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Dispositif.*Contrat de comportement/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /AR.*Temps supplémentaire/ }));
    expect(onChange).toHaveBeenCalledWith({ chapitres: [], amenagements: ['a2'] });
  });
  it('signale un aménagement désactivé dans AménagActif', () => {
    selecteur({ selection: { chapitres: [], amenagements: ['a3'] } });
    voirDetail(0);
    expect(screen.getByText(/désactivé dans AménagActif/)).toBeInTheDocument();
  });
  it('masquer les AR cache leurs détails sans changer la sélection', () => {
    const { onChange } = selecteur();
    fireEvent.click(screen.getByRole('checkbox', { name: /^AR :/ }));
    voirDetail(0);
    expect(screen.getByText('Police lisible')).toBeInTheDocument();
    expect(screen.queryByText('Temps supplémentaire')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('« Autre » prévient le parent, absent en mode filtre', () => {
    const { onAutre } = selecteur();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Autre (préciser)' }));
    expect(onAutre).toHaveBeenCalledWith({ coche: true, texte: '' });
  });
  it('n\'affiche pas « Autre » en mode filtre', () => {
    selecteur({ sansAutre: true });
    expect(screen.queryByRole('checkbox', { name: 'Autre (préciser)' })).not.toBeInTheDocument();
  });
});

const criteres = [
  { id: 'k1', famille: 'trouble', libelle: 'Dyslexie', aide: 'a' },
  { id: 'k2', famille: 'trouble', libelle: 'TDAH', aide: 'b' },
  { id: 'k3', famille: 'difficulte', libelle: 'Lecture', aide: 'c' },
];
const valeur = () => ({ critereIds: ['k3'], selection: selectionVide(), autres: autresVides() });

describe('PourQui', () => {
  it('montre la mention indicative et les trois listes', () => {
    render(<PourQui criteres={criteres} catalogue={catalogue} valeur={valeur()} onChange={() => {}} />);
    expect(screen.getByText(MENTION_INDICATIVE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Troubles concernés/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Difficultés d'apprentissage.*Lecture/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /1\. SUPPORTS ET DOCUMENTS/ })).toBeInTheDocument();
  });
  it('remplace seulement les critères de la famille modifiée', () => {
    const onChange = vi.fn();
    render(<PourQui criteres={criteres} catalogue={catalogue} valeur={valeur()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Troubles concernés/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dyslexie' }));
    expect(onChange.mock.calls[0][0].critereIds).toEqual(['k3', 'k1']);
  });
  it('en erreur de chargement : message, mention, aucune case', () => {
    render(<PourQui criteres={[]} catalogue={[]} valeur={valeur()} onChange={() => {}} erreur={new Error('réseau')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Les listes n\'ont pas pu être chargées');
    expect(screen.getByText(MENTION_INDICATIVE)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Troubles/ })).not.toBeInTheDocument();
  });
  it('pendant le chargement : message, aucune liste', () => {
    render(<PourQui criteres={[]} catalogue={[]} valeur={valeur()} onChange={() => {}} chargement />);
    expect(screen.getByText('Chargement des listes…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Troubles/ })).not.toBeInTheDocument();
  });
});
