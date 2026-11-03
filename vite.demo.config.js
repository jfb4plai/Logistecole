// Mode démonstration : toute l'application, branchée sur des données fictives en mémoire.
// Aucune connexion à Supabase, rien n'est enregistré. Lancer avec : npm run demo
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const demo = (f) => fileURLToPath(new URL(`./src/demo/${f}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5181 },
  resolve: {
    alias: [
      { find: /^.*\/data\/(objets|prets|referentiels|membres|importer|journal|criteres)\.js$/, replacement: `${demo('')}$1.js` },
      // Les modules de src/data s'importent aussi entre eux en relatif (./objets.js).
      { find: /^\.\/(objets|prets|referentiels|membres|importer|journal|criteres)\.js$/, replacement: `${demo('')}$1.js` },
      { find: /^.*\/lib\/(auth|org)\.jsx$/, replacement: `${demo('')}$1.jsx` },
      { find: /^.*\/lib\/supabase\.js$/, replacement: demo('supabase.js') },
    ],
  },
});
