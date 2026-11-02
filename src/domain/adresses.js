// Accepte une adresse par ligne, ou séparées par des virgules, points-virgules ou espaces.
export const extraireAdresses = (texte) => String(texte ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
