export default function ChampGuide({ id, label, aide, obligatoire = false, children }) {
  return (
    <div className="plai-field">
      <label htmlFor={id} className="plai-label">
        {label}
        {obligatoire && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      <p id={`${id}-aide`} className="champ-aide">{aide}</p>
    </div>
  );
}
