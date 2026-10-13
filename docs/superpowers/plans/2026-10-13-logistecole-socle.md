# Logistécole — socle : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Livrer le socle de Logistécole : inventaire multi-organisations (Pôle et écoles) avec comptes gestionnaires, objets, emplacements, catégories, historique en écriture seule, scan et étiquettes QR, gratuit pour les écoles.

**Architecture :** SPA React (Vite) servie par Vercel, base et auth Supabase (projet partagé), toutes les tables `logi_*` isolées par organisation via RLS et fonctions `security definer`. L'historique est alimenté par des triggers (pas par le client) et n'accorde aucun `update`/`delete`. Une seule fonction serverless (`api/inviter.js`) utilise la clé service pour inviter des membres. Scan par `qr-scanner`, étiquettes PDF par `jspdf` + `qrcode`, côté navigateur.

**Tech Stack :** React 18, Vite 5, react-router-dom 6, @tanstack/react-query 5, @supabase/supabase-js 2, qr-scanner, qrcode, jspdf, vitest + testing-library. Pas de Tailwind (écart volontaire par rapport à la stack de référence : le CSS partagé `plai-style.css` + un fichier `logistecole.css` suffisent, une dépendance de moins).

**Spec :** `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\docs\superpowers\specs\2026-10-13-logistecole-socle-design.md`

Racine du projet (toutes les commandes s'exécutent ici sauf mention) : `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole`

## Global Constraints

- Branche Git `main` uniquement (branche de production Vercel) ; dépôt `jfb4plai/Logistecole`. Pas de `gh` CLI : le dépôt vide est créé par JF sur github.com, le push passe par les identifiants GCM en cache.
- `npx vite build` doit passer sans erreur avant tout `git push`.
- Tout `git commit` se termine par : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (passé en second `-m`).
- Tables Supabase toutes préfixées `logi_` ; ne pas recréer `profiles` ni son trigger `updated_at` ; `GRANT` Data API dans la même migration que chaque `create table` ; RLS sur toutes les tables.
- Aucune politique RLS ne contient d'EXISTS auto-joint sur sa propre table : uniquement les fonctions `logi_est_membre` / `logi_a_role` (incident AménagActif 2026-09-23).
- Appliquer la migration en base ou envoyer un e-mail réel seulement avec l'accord explicite de JF dans la conversation. Les tests SQL tournent dans une transaction annulée.
- Aucune clé dans le frontend hors `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Aucun `console.log` de données utilisateur. Secrets Vercel posés avec `printf`, pas `echo`, puis vérifiés avec `vercel env pull`.
- Pas de noms d'élèves : emprunteurs enseignants = initiales, élèves = code anonyme.
- Interface : texte 16 px minimum, boutons et champs d'au moins 44 px de haut, état jamais signalé par la couleur seule, pas d'emojis, aucun terme « collège / lycée » (exemples FWB : école, implantation, CEB, CE1D).
- Tout champ de formulaire : label précis + placeholder concret avec exemple FWB + texte d'aide sous le champ (composant `ChampGuide`).
- Charte : teal #0f6e56, orange #f97316, DM Sans (texte), DM Serif Display (titres), logo `/plai-logo.jpg` à hauteur fixe 32 px (nav) / 40 px (footer), largeur automatique (logo non carré, ratio 2,56:1). Pas de suffixe « -Actif ».
- Email de contact public : `jf.beguin@outlook.com`.
- Pas de mode hors ligne, pas de notifications, pas d'application native : le dire dans l'interface (encart « ce qui arrive ensuite »).

## Review Focus

Cinq entrées que la spec laisse implicites et que les tests des tâches doivent épingler :

1. **QR ou texte scanné qui n'est pas une étiquette Logistécole** (autre site, texte libre, code à 6 caractères, code avec `0` ou `O`) : refus clair, jamais d'erreur technique ni de navigation vers une fiche vide. Tests : Tâche 3 (`extraireCodeDepuisTexte`), Tâche 7 (message « introuvable »).
2. **Création en lot invalide** (quantité 0, 101, 2,5, vide ; nom vide ou de 500 caractères) : refus avant tout appel réseau, rien n'est créé. Tests : Tâche 4 (`validerLot`) et SQL (fonction `logi_creer_objets` refuse > 100).
3. **Compte connecté sans aucune organisation** (invité retiré, compte de test) : écran explicatif avec contact, pas de page blanche ni de boucle. Tests : Tâche 3 (`choisirOrganisationActive`), Tâche 5 (`AucuneOrganisation`).
4. **Fichier photo qui n'est pas une image ou trop lourd** (PDF, 40 Mo) : refus lisible avant compression. Tests : Tâche 4 (`validerFichierPhoto`).
5. **Nom d'objet très long ou avec caractères hors Latin-1 sur l'étiquette** : le texte est tronqué et nettoyé, il ne déborde pas de la cellule et ne produit pas de caractères illisibles. Tests : Tâche 10 (`tronquerTexte`, `nettoyerPourPdf`).

---

## Structure des fichiers

```
logistecole/
  package.json  vite.config.js  vitest.config.js  vercel.json  index.html
  .gitignore  .env.example  LICENSE  README.md
  public/            plai-logo.jpg  icon.svg  manifest.webmanifest
  api/inviter.js
  supabase/migrations/20261013_logistecole_core.sql
  supabase/tests/logistecole_rls.sql
  src/main.jsx  App.jsx  plai-style.css  logistecole.css
  src/lib/       supabase.js  auth.jsx  org.jsx  queryClient.js  erreurs.js
  src/domain/    codes.js  etats.js  permissions.js  organisation.js  lot.js
                 image.js  historique.js  filtres.js  etiquettes.js
  src/data/      objets.js  referentiels.js  membres.js  hooks.js
  src/components/ Nav.jsx  Footer.jsx  RequireAuth.jsx  ChampGuide.jsx  EtatBadge.jsx
  src/pages/     Connexion.jsx  AucuneOrganisation.jsx  Accueil.jsx  FicheObjet.jsx
                 FormulaireObjet.jsx  Scan.jsx  Etiquettes.jsx  Admin.jsx
                 AdminReferentiel.jsx  AdminMembres.jsx
  src/test/setup.js
  tests/domain/*.test.js  tests/components/*.test.jsx  tests/api/inviter.test.js
  docs/recette-socle.md
```

Responsabilités : `domain/` = fonctions pures testées, sans réseau ni DOM ; `data/` = seul endroit qui parle à Supabase ; `pages/` = écrans ; `components/` = briques partagées.

---

### Task 1 : Squelette du projet et dépôt local

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `vercel.json`, `index.html`, `.gitignore`, `.env.example`, `README.md`, `src/main.jsx`, `src/App.jsx` (provisoire), `src/test/setup.js`, `src/plai-style.css` (copie), `public/plai-logo.jpg` (copie), `LICENSE` (copie)

**Interfaces:**
- Produces: projet qui installe, build et teste (zéro test) ; alias de scripts `dev`, `build`, `test`.

- [ ] **Step 1 : Créer les fichiers de configuration**

`package.json` :
```json
{
  "name": "logistecole",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.115.0",
    "@tanstack/react-query": "^5.102.8",
    "jspdf": "^2.5.2",
    "qr-scanner": "^1.4.2",
    "qrcode": "^1.5.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.3",
    "@vitejs/plugin-react": "^4.7.0",
    "jsdom": "^25.0.1",
    "jsqr": "^1.4.0",
    "pngjs": "^7.0.0",
    "vite": "^5.4.21",
    "vitest": "^2.1.9"
  }
}
```

`vite.config.js` :
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

`vitest.config.js` :
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['tests/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx}'],
  },
});
```

`src/test/setup.js` :
```js
import '@testing-library/jest-dom/vitest';
```

`vercel.json` :
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Referrer-Policy", "value": "no-referrer" }
      ]
    }
  ]
}
```

`.gitignore` :
```
node_modules
dist
.env
.env.*
!.env.example
.vercel
```

`.env.example` :
```
# Frontend (publiques)
VITE_SUPABASE_URL=https://dfoaumjleqtxjeaplnna.supabase.co
VITE_SUPABASE_ANON_KEY=
# Serveur uniquement (Vercel, jamais dans le frontend)
SUPABASE_SERVICE_ROLE_KEY=
SITE_URL=https://logistecole.jfb4plai.com
```

`index.html` :
```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f6e56" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
    <title>Logistécole</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`README.md` :
```markdown
# Logistécole

Gestion gratuite du matériel des écoles et du Pôle (inventaire, QR codes, prêts). Un outil PLAI.

- Dev : `npm run dev` (interface) ; `vercel dev` pour tester `/api/*`.
- Tests : `npm test` ; tests SQL dans `supabase/tests/`.
- Spec et plans : `docs/superpowers/`.
```

`src/main.jsx` et `src/App.jsx` provisoires :
```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './plai-style.css';

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
```
```jsx
// src/App.jsx
export default function App() {
  return <p>Logistécole</p>;
}
```

- [ ] **Step 2 : Copier les ressources PLAI et la licence**

Run (Bash) :
```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && mkdir -p public src/test && cp ../shared/css/plai-style.css src/plai-style.css && cp ../projets/portail-plai/public/plai-logo.jpg public/plai-logo.jpg && cp ../AmenagActif/LICENSE LICENSE && ls public src LICENSE
```
Expected : `plai-logo.jpg`, `plai-style.css`, `LICENSE` listés.

- [ ] **Step 3 : Installer, tester, construire**

Run : `cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && npm install && npm test && npx vite build`
Expected : install OK, `No test files found, exiting with code 0` (grâce à `--passWithNoTests`), build `built in …`.

- [ ] **Step 4 : Initialiser Git**

Run :
```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && git init -b main && git add -A && git commit -m "chore: squelette Logistécole (Vite, React, vitest, charte PLAI)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git log --oneline
```
Expected : un commit sur `main`.

- [ ] **Step 5 : Demander à JF de créer le dépôt GitHub (accord requis)**

Demander à JF : « Créez le dépôt vide `jfb4plai/Logistecole` sur github.com (sans README, sans licence), puis dites-moi OK. » Après OK :
```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && git remote add origin https://github.com/jfb4plai/Logistecole.git && git push -u origin main
```
Expected : push réussi (identifiants GCM en cache). Si refus d'authentification, s'arrêter et le dire à JF.

---

### Task 2 : Migration SQL, RLS, triggers et tests SQL

**Files:**
- Create: `supabase/migrations/20261013_logistecole_core.sql`
- Create: `supabase/tests/logistecole_rls.sql`

**Interfaces:**
- Produces (SQL) : tables `logi_organisations`, `logi_membres(user_id, org_id, role, email, cree_le)`, `logi_emplacements`, `logi_categories`, `logi_objets`, `logi_historique`, `logi_emprunteurs` ; fonctions `logi_est_membre(uuid)`, `logi_a_role(uuid, text[])`, `logi_creer_objets(p_org uuid, p_objets jsonb) returns table(objet_id uuid, objet_code text)`, `logi_nouvelle_organisation(p_nom, p_type, p_admin uuid) returns uuid`, `logi_id_par_email(p_email text) returns uuid` ; bucket privé `logi-photos` ; types d'historique : `creation`, `deplacement`, `etat`, `modification` (champ dans `commentaire`), `correction`, `note`.

- [ ] **Step 1 : Vérifier l'absence de conflit de noms**

Run : `cd /c/Users/jfbeg/OneDrive/claude-workspace && grep -rIn "logi_" --include=*.sql --exclude-dir=node_modules --exclude-dir=logistecole . | head`
Expected : aucune ligne.

- [ ] **Step 2 : Écrire la migration**

`supabase/migrations/20261013_logistecole_core.sql` :
```sql
-- Logistécole — socle : organisations, membres, inventaire, historique en écriture seule.
-- Tables préfixées logi_. profiles et son trigger updated_at ne sont pas touchés.
begin;

-- ── Organisations et membres ───────────────────────────────────────────
create table logi_organisations (
  id      uuid primary key default gen_random_uuid(),
  nom     text not null check (length(trim(nom)) between 1 and 120),
  type    text not null check (type in ('pole', 'ecole')),
  statut  text not null default 'actif' check (statut in ('actif', 'suspendu')), -- informatif en v1
  cree_le timestamptz not null default now()
);

create table logi_membres (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id  uuid not null references logi_organisations(id) on delete cascade,
  role    text not null check (role in ('admin', 'gestionnaire', 'lecture')),
  email   text,
  cree_le timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index logi_membres_org on logi_membres (org_id);

-- Fonctions d'accès : security definer, donc pas de récursion RLS.
create or replace function logi_est_membre(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from logi_membres where user_id = auth.uid() and org_id = p_org);
$$;

create or replace function logi_a_role(p_org uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from logi_membres
    where user_id = auth.uid() and org_id = p_org and role = any (p_roles)
  );
$$;

revoke all on function logi_est_membre(uuid) from public, anon;
revoke all on function logi_a_role(uuid, text[]) from public, anon;
grant execute on function logi_est_membre(uuid) to authenticated;
grant execute on function logi_a_role(uuid, text[]) to authenticated;

-- ── Inventaire ─────────────────────────────────────────────────────────
create table logi_emplacements (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references logi_organisations(id) on delete cascade,
  parent_id uuid references logi_emplacements(id) on delete restrict,
  nom       text not null check (length(trim(nom)) between 1 and 120),
  cree_le   timestamptz not null default now()
);
create unique index logi_emplacements_nom
  on logi_emplacements (org_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nom));

create table logi_categories (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references logi_organisations(id) on delete cascade,
  nom     text not null check (length(trim(nom)) between 1 and 120),
  cree_le timestamptz not null default now(),
  unique (org_id, nom)
);

create table logi_objets (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references logi_organisations(id) on delete cascade,
  nom            text not null check (length(trim(nom)) between 1 and 120),
  categorie_id   uuid references logi_categories(id) on delete restrict,
  emplacement_id uuid references logi_emplacements(id) on delete restrict,
  etat           text not null default 'bon' check (etat in ('bon', 'use', 'defectueux', 'perdu', 'sorti')),
  photo_path     text,
  notes          text check (notes is null or length(notes) <= 2000),
  code           text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);
create index logi_objets_org on logi_objets (org_id);

create table logi_historique (
  id           bigint generated always as identity primary key,
  objet_id     uuid not null references logi_objets(id) on delete cascade,
  org_id       uuid not null references logi_organisations(id) on delete cascade,
  auteur       uuid default auth.uid(),
  auteur_email text default (auth.jwt() ->> 'email'),
  quand        timestamptz not null default now(),
  type         text not null check (type in ('creation', 'deplacement', 'etat', 'modification', 'correction', 'note')),
  avant        text,
  apres        text,
  commentaire  text check (commentaire is null or length(commentaire) <= 1000)
);
create index logi_historique_objet on logi_historique (objet_id, quand desc);

create table logi_emprunteurs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references logi_organisations(id) on delete cascade,
  type         text not null check (type in ('enseignant', 'eleve', 'organisation')),
  libelle      text not null check (length(trim(libelle)) between 1 and 60), -- initiales ou code anonyme
  org_liee_id  uuid references logi_organisations(id) on delete set null,
  compte_id    uuid references auth.users(id) on delete set null, -- lien futur (sous-projet 4)
  cree_le      timestamptz not null default now()
);

-- ── Triggers : cohérence, horodatage, trace historique, dernier admin ──
create or replace function logi_avant_ecriture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'logi_emplacements' then
    if new.parent_id is not null
       and not exists (select 1 from logi_emplacements p where p.id = new.parent_id and p.org_id = new.org_id) then
      raise exception 'L''emplacement parent doit appartenir à la même organisation';
    end if;
  elsif tg_table_name = 'logi_objets' then
    if tg_op = 'UPDATE' and new.org_id <> old.org_id then
      raise exception 'Un objet ne peut pas changer d''organisation';
    end if;
    if new.categorie_id is not null
       and not exists (select 1 from logi_categories c where c.id = new.categorie_id and c.org_id = new.org_id) then
      raise exception 'La catégorie doit appartenir à la même organisation';
    end if;
    if new.emplacement_id is not null
       and not exists (select 1 from logi_emplacements e where e.id = new.emplacement_id and e.org_id = new.org_id) then
      raise exception 'L''emplacement doit appartenir à la même organisation';
    end if;
    new.maj_le := now();
  end if;
  return new;
end $$;

create trigger logi_emplacements_avant before insert or update on logi_emplacements
  for each row execute function logi_avant_ecriture();
create trigger logi_objets_avant before insert or update on logi_objets
  for each row execute function logi_avant_ecriture();

create or replace function logi_trace_objet() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_avant text; v_apres text;
begin
  if tg_op = 'INSERT' then
    insert into logi_historique (objet_id, org_id, type, apres) values (new.id, new.org_id, 'creation', new.nom);
    return new;
  end if;
  if new.emplacement_id is distinct from old.emplacement_id then
    select nom into v_avant from logi_emplacements where id = old.emplacement_id;
    select nom into v_apres from logi_emplacements where id = new.emplacement_id;
    insert into logi_historique (objet_id, org_id, type, avant, apres) values (new.id, new.org_id, 'deplacement', v_avant, v_apres);
  end if;
  if new.etat is distinct from old.etat then
    insert into logi_historique (objet_id, org_id, type, avant, apres) values (new.id, new.org_id, 'etat', old.etat, new.etat);
  end if;
  if new.nom is distinct from old.nom then
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire) values (new.id, new.org_id, 'modification', old.nom, new.nom, 'nom');
  end if;
  if new.categorie_id is distinct from old.categorie_id then
    select nom into v_avant from logi_categories where id = old.categorie_id;
    select nom into v_apres from logi_categories where id = new.categorie_id;
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire) values (new.id, new.org_id, 'modification', v_avant, v_apres, 'catégorie');
  end if;
  if new.notes is distinct from old.notes then
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire) values (new.id, new.org_id, 'modification', left(old.notes, 300), left(new.notes, 300), 'notes');
  end if;
  if new.photo_path is distinct from old.photo_path then
    insert into logi_historique (objet_id, org_id, type, commentaire) values (new.id, new.org_id, 'modification', 'photo');
  end if;
  return new;
end $$;

create trigger logi_objets_trace after insert or update on logi_objets
  for each row execute function logi_trace_objet();

-- Une organisation garde toujours au moins un administrateur.
create or replace function logi_garder_un_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if exists (select 1 from logi_organisations where id = old.org_id)
       and not exists (select 1 from logi_membres where org_id = old.org_id and role = 'admin' and user_id <> old.user_id) then
      raise exception 'Une organisation doit garder au moins un administrateur';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger logi_membres_garder_admin before update or delete on logi_membres
  for each row execute function logi_garder_un_admin();

-- ── RPC : création en lot atomique (max 100) ───────────────────────────
create or replace function logi_creer_objets(p_org uuid, p_objets jsonb)
returns table (objet_id uuid, objet_code text)
language plpgsql security invoker set search_path = public as $$
begin
  if jsonb_typeof(p_objets) <> 'array' then
    raise exception 'La liste d''objets est invalide';
  end if;
  if jsonb_array_length(p_objets) < 1 or jsonb_array_length(p_objets) > 100 then
    raise exception 'Entre 1 et 100 objets par opération';
  end if;
  return query
    insert into logi_objets (org_id, nom, categorie_id, emplacement_id, etat, photo_path, notes, code)
    select p_org, o.nom, o.categorie_id, o.emplacement_id, coalesce(o.etat, 'bon'), o.photo_path, o.notes, o.code
    from jsonb_to_recordset(p_objets) as o(nom text, categorie_id uuid, emplacement_id uuid, etat text, photo_path text, notes text, code text)
    returning logi_objets.id, logi_objets.code;
end $$;

revoke all on function logi_creer_objets(uuid, jsonb) from public, anon;
grant execute on function logi_creer_objets(uuid, jsonb) to authenticated;

-- ── Fonctions réservées à l'administration (SQL Editor / clé service) ──
create or replace function logi_nouvelle_organisation(p_nom text, p_type text, p_admin uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text;
begin
  insert into logi_organisations (nom, type) values (p_nom, p_type) returning id into v_id;
  select email into v_email from auth.users where id = p_admin;
  insert into logi_membres (user_id, org_id, role, email) values (p_admin, v_id, 'admin', v_email);
  insert into logi_categories (org_id, nom)
    select v_id, c from unnest(array[
      'Tablettes et ordinateurs', 'Projection et son', 'Matériel de sciences', 'Matériel de sport',
      'Manuels et livres', 'Matériel d''aménagements raisonnables', 'Mobilier', 'Autre'
    ]) as c;
  return v_id;
end $$;

create or replace function logi_id_par_email(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function logi_nouvelle_organisation(text, text, uuid) from public, anon, authenticated;
revoke all on function logi_id_par_email(text) from public, anon, authenticated;
grant execute on function logi_id_par_email(text) to service_role;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table logi_organisations enable row level security;
alter table logi_membres       enable row level security;
alter table logi_emplacements  enable row level security;
alter table logi_categories    enable row level security;
alter table logi_objets        enable row level security;
alter table logi_historique    enable row level security;
alter table logi_emprunteurs   enable row level security;

create policy logi_orgs_select on logi_organisations for select to authenticated
  using (logi_est_membre(id));

create policy logi_membres_select on logi_membres for select to authenticated
  using (user_id = auth.uid() or logi_a_role(org_id, array['admin']));
create policy logi_membres_update on logi_membres for update to authenticated
  using (logi_a_role(org_id, array['admin'])) with check (logi_a_role(org_id, array['admin']));
create policy logi_membres_delete on logi_membres for delete to authenticated
  using (logi_a_role(org_id, array['admin']));

create policy logi_emplacements_select on logi_emplacements for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_emplacements_ecrire on logi_emplacements for all to authenticated
  using (logi_a_role(org_id, array['admin'])) with check (logi_a_role(org_id, array['admin']));

create policy logi_categories_select on logi_categories for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_categories_ecrire on logi_categories for all to authenticated
  using (logi_a_role(org_id, array['admin'])) with check (logi_a_role(org_id, array['admin']));

create policy logi_objets_select on logi_objets for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_objets_insert on logi_objets for insert to authenticated
  with check (logi_a_role(org_id, array['admin', 'gestionnaire']));
create policy logi_objets_update on logi_objets for update to authenticated
  using (logi_a_role(org_id, array['admin', 'gestionnaire']))
  with check (logi_a_role(org_id, array['admin', 'gestionnaire']));
create policy logi_objets_delete on logi_objets for delete to authenticated
  using (logi_a_role(org_id, array['admin']));

create policy logi_historique_select on logi_historique for select to authenticated
  using (logi_est_membre(org_id));
-- Le client n'écrit que des corrections et des notes ; le reste vient des triggers.
create policy logi_historique_insert on logi_historique for insert to authenticated
  with check (
    logi_a_role(org_id, array['admin', 'gestionnaire'])
    and auteur = auth.uid()
    and type in ('correction', 'note')
    and org_id = (select o.org_id from logi_objets o where o.id = objet_id)
  );

create policy logi_emprunteurs_select on logi_emprunteurs for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_emprunteurs_ecrire on logi_emprunteurs for all to authenticated
  using (logi_a_role(org_id, array['admin', 'gestionnaire']))
  with check (logi_a_role(org_id, array['admin', 'gestionnaire']));

-- ── Grants Data API (anon : aucun accès) ───────────────────────────────
grant select on logi_organisations to authenticated;
grant select on logi_organisations to service_role;

grant select, delete on logi_membres to authenticated;
grant update (role) on logi_membres to authenticated;
grant select, insert, update, delete on logi_membres to service_role;

grant select, insert, update, delete on logi_emplacements to authenticated, service_role;
grant select, insert, update, delete on logi_categories   to authenticated, service_role;
grant select, insert, update, delete on logi_objets       to authenticated, service_role;
grant select, insert on logi_historique to authenticated, service_role; -- jamais update ni delete
grant select, insert, update, delete on logi_emprunteurs  to authenticated, service_role;

-- ── Photos : bucket privé, chemins <org_id>/<fichier>.jpg ──────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logi-photos', 'logi-photos', false, 512000, array['image/jpeg'])
on conflict (id) do nothing;

create policy logi_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'logi-photos' and logi_est_membre(((storage.foldername(name))[1])::uuid));
create policy logi_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logi-photos' and logi_a_role(((storage.foldername(name))[1])::uuid, array['admin', 'gestionnaire']));
create policy logi_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'logi-photos' and logi_a_role(((storage.foldername(name))[1])::uuid, array['admin', 'gestionnaire']));
create policy logi_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logi-photos' and logi_a_role(((storage.foldername(name))[1])::uuid, array['admin', 'gestionnaire']));

commit;
```

- [ ] **Step 3 : Écrire les tests SQL (transaction annulée)**

`supabase/tests/logistecole_rls.sql` :
```sql
-- Tests RLS Logistécole. Le script se termine par ROLLBACK : aucune donnée ne reste.
-- Une assertion qui échoue arrête le script avec un message explicite.
begin;

-- Assistants (créés dans la transaction, annulés à la fin)
create function public.zz_echec(p_sql text, p_attendus text[]) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = any (p_attendus) then return; end if;
    raise exception 'sqlstate % (%) au lieu de % pour : %', sqlstate, sqlerrm, p_attendus, p_sql;
  end;
  raise exception 'aurait dû échouer : %', p_sql;
end $$;

create function public.zz_lignes(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- Données de départ (rôle propriétaire)
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'a-admin@test.invalid'),
  ('a0000000-0000-0000-0000-000000000002', 'a-gest@test.invalid'),
  ('a0000000-0000-0000-0000-000000000003', 'a-lect@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', 'b-admin@test.invalid');

insert into logi_organisations (id, nom, type) values
  ('11111111-1111-1111-1111-111111111111', 'École A', 'ecole'),
  ('22222222-2222-2222-2222-222222222222', 'Pôle B', 'pole');

insert into logi_membres (user_id, org_id, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin', 'a-admin@test.invalid'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'gestionnaire', 'a-gest@test.invalid'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'lecture', 'a-lect@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin', 'b-admin@test.invalid');

insert into logi_categories (id, org_id, nom) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Tablettes'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Casques');

insert into logi_objets (id, org_id, nom, categorie_id, code) values
  ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Valise tablettes', 'c1111111-1111-1111-1111-111111111111', 'AAAA2222'),
  ('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Casque anti-bruit', 'c2222222-2222-2222-2222-222222222222', 'BBBB3333');

-- ── Admin de A ─────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","email":"a-admin@test.invalid"}', true);
set local role authenticated;

do $t$ begin
  assert (select count(*) from logi_organisations) = 1, 'admin A ne voit que son organisation';
  assert (select count(*) from logi_objets) = 1, 'admin A ne voit que les objets de A';
  assert (select count(*) from logi_membres) = 3, 'admin A voit les 3 membres de A';
  assert (select count(*) from logi_categories) = 1, 'admin A ne voit que les catégories de A';
end $t$;

select zz_echec($$insert into logi_objets (org_id, nom, code) values ('22222222-2222-2222-2222-222222222222', 'Intrus', 'CCCC4444')$$, array['42501']);
select zz_echec($$insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Doublon', 'AAAA2222')$$, array['23505']);
select zz_echec($$insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Code invalide', 'abc')$$, array['23514']);
-- catégorie d'une autre organisation : refusée par le trigger
select zz_echec($$insert into logi_objets (org_id, nom, categorie_id, code) values ('11111111-1111-1111-1111-111111111111', 'Mélange', 'c2222222-2222-2222-2222-222222222222', 'DDDD5555')$$, array['P0001']);

-- Lot : 101 refusé, 2 acceptés avec traces de création
select zz_echec($$select * from logi_creer_objets('11111111-1111-1111-1111-111111111111', (select jsonb_agg(jsonb_build_object('nom', 'x', 'code', 'ZZ' || lpad(g::text, 6, '2')) ) from generate_series(1, 101) g))$$, array['P0001']);
select zz_echec($$select * from logi_creer_objets('11111111-1111-1111-1111-111111111111', '[]'::jsonb)$$, array['P0001']);
do $t$ declare n int; begin
  select count(*) into n from logi_creer_objets('11111111-1111-1111-1111-111111111111',
    '[{"nom":"Tablette 1","code":"EEEE2222"},{"nom":"Tablette 2","code":"EEEE3333"}]'::jsonb);
  assert n = 2, 'le lot de 2 doit créer 2 objets';
  assert (select count(*) from logi_historique where type = 'creation' and apres like 'Tablette %') = 2, 'chaque création est tracée';
end $t$;

-- Trace d'une modification, avec l'auteur
update logi_objets set nom = 'Valise de 16 tablettes' where id = 'd1111111-1111-1111-1111-111111111111';
do $t$ begin
  assert exists (
    select 1 from logi_historique
    where objet_id = 'd1111111-1111-1111-1111-111111111111' and type = 'modification' and commentaire = 'nom'
      and avant = 'Valise tablettes' and apres = 'Valise de 16 tablettes'
      and auteur = 'a0000000-0000-0000-0000-000000000001' and auteur_email = 'a-admin@test.invalid'
  ), 'la modification du nom est tracée avec auteur et valeurs';
end $t$;

-- Changement d'organisation interdit
select zz_echec($$update logi_objets set org_id = '22222222-2222-2222-2222-222222222222' where id = 'd1111111-1111-1111-1111-111111111111'$$, array['P0001', '42501']);

-- Historique : jamais update ni delete, même pour un admin
select zz_echec($$update logi_historique set commentaire = 'falsifié'$$, array['42501']);
select zz_echec($$delete from logi_historique$$, array['42501']);
-- Corrections et notes autorisées ; autres types refusés ; objet d'une autre org refusé
insert into logi_historique (objet_id, org_id, type, commentaire)
  values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'correction', 'La salle est la 21');
select zz_echec($$insert into logi_historique (objet_id, org_id, type) values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'deplacement')$$, array['42501']);
select zz_echec($$insert into logi_historique (objet_id, org_id, type, commentaire) values ('d2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'note', 'x')$$, array['42501']);

-- Emplacement parent d'une autre organisation refusé
do $t$ begin
  insert into logi_emplacements (id, org_id, nom) values ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Bâtiment principal');
end $t$;
select zz_echec($$insert into logi_emplacements (org_id, parent_id, nom) values ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'Intrus')$$, array['P0001', '42501']);

-- Dernier admin protégé
select zz_echec($$delete from logi_membres where user_id = 'a0000000-0000-0000-0000-000000000001'$$, array['P0001']);
select zz_echec($$update logi_membres set role = 'lecture' where user_id = 'a0000000-0000-0000-0000-000000000001'$$, array['P0001']);

reset role;

-- ── Gestionnaire de A ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated","email":"a-gest@test.invalid"}', true);
set local role authenticated;

insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Projecteur', 'FFFF2222');
do $t$ begin
  assert zz_lignes($$delete from logi_objets where code = 'FFFF2222'$$) = 0, 'un gestionnaire ne peut pas supprimer un objet';
  assert zz_lignes($$update logi_objets set etat = 'use' where code = 'FFFF2222'$$) = 1, 'un gestionnaire peut modifier un objet';
  assert exists (select 1 from logi_historique where type = 'etat' and avant = 'bon' and apres = 'use'), 'le changement d''état est tracé';
end $t$;
select zz_echec($$insert into logi_emplacements (org_id, nom) values ('11111111-1111-1111-1111-111111111111', 'Salle 12')$$, array['42501']);
select zz_echec($$insert into logi_categories (org_id, nom) values ('11111111-1111-1111-1111-111111111111', 'Autre chose')$$, array['42501']);
do $t$ begin
  assert zz_lignes($$update logi_membres set role = 'admin' where user_id = 'a0000000-0000-0000-0000-000000000003'$$) = 0, 'un gestionnaire ne change pas les rôles';
end $t$;

reset role;

-- ── Lecture seule de A ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","email":"a-lect@test.invalid"}', true);
set local role authenticated;

do $t$ begin
  assert (select count(*) from logi_objets) >= 1, 'le rôle lecture voit les objets';
end $t$;
select zz_echec($$insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Interdit', 'GGGG2222')$$, array['42501']);
do $t$ begin
  assert zz_lignes($$update logi_objets set nom = 'Modifié' where code = 'AAAA2222'$$) = 0, 'le rôle lecture ne modifie rien';
end $t$;
select zz_echec($$insert into logi_historique (objet_id, org_id, type, commentaire) values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'note', 'x')$$, array['42501']);

reset role;

-- ── Admin de B : isolation inverse ─────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated","email":"b-admin@test.invalid"}', true);
set local role authenticated;

do $t$ begin
  assert (select count(*) from logi_objets) = 1, 'admin B ne voit que les objets de B';
  assert (select count(*) from logi_historique where org_id = '11111111-1111-1111-1111-111111111111') = 0, 'admin B ne voit pas l''historique de A';
  assert zz_lignes($$update logi_objets set nom = 'Piraté' where id = 'd1111111-1111-1111-1111-111111111111'$$) = 0, 'admin B ne modifie pas un objet de A';
  assert zz_lignes($$delete from logi_objets where id = 'd1111111-1111-1111-1111-111111111111'$$) = 0, 'admin B ne supprime pas un objet de A';
end $t$;

reset role;

-- ── Anonyme : aucun accès ──────────────────────────────────────────────
set local role anon;
select zz_echec($$select * from logi_objets$$, array['42501']);
select zz_echec($$select * from logi_organisations$$, array['42501']);
reset role;

-- ── Admin de A supprime un objet (autorisé) ────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","email":"a-admin@test.invalid"}', true);
set local role authenticated;
do $t$ begin
  assert zz_lignes($$delete from logi_objets where code = 'FFFF2222'$$) = 1, 'un admin peut supprimer un objet';
end $t$;
reset role;

-- ── Création d'une organisation par la fonction d'administration ───────
do $t$ declare v uuid; begin
  v := logi_nouvelle_organisation('École test', 'ecole', 'a0000000-0000-0000-0000-000000000002');
  assert (select count(*) from logi_categories where org_id = v) = 8, '8 catégories de départ';
  assert (select role from logi_membres where org_id = v) = 'admin', 'l''admin est créé';
end $t$;

select 'LOGISTECOLE RLS : tous les tests passent' as resultat;
rollback;
```

- [ ] **Step 4 : Relire ce qui sera exécuté et demander l'accord de JF**

Demander à JF : « La migration `20261013_logistecole_core.sql` crée 7 tables `logi_*`, 5 fonctions, un bucket photos privé et des politiques sur `storage.objects`, dans le projet Supabase partagé `dfoaumjleqtxjeaplnna`. Je l'applique ? Et par quelle voie (SQL Editor que vous collez vous-même, ou une commande que je lance) ? » Ne rien appliquer avant le oui.

- [ ] **Step 5 : Appliquer, puis exécuter les tests SQL**

Après accord : exécuter d'abord la migration, puis `supabase/tests/logistecole_rls.sql`.
Expected : dernière ligne de résultat `LOGISTECOLE RLS : tous les tests passent`. Si l'insertion dans `auth.users` échoue (trigger d'une autre app sur cette table), noter le message exact, adapter l'insertion de test (colonnes obligatoires) et relancer. Si une assertion échoue, corriger la migration ou le test selon la cause (pas l'inverse par défaut : le test dit ce que la spec exige).

- [ ] **Step 6 : Commit**

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && git add supabase && git commit -m "feat(db): schéma logi_*, RLS, triggers d'historique, tests SQL" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Domaine pur — codes courts, états, permissions, organisation active

**Files:**
- Create: `src/domain/codes.js`, `src/domain/etats.js`, `src/domain/permissions.js`, `src/domain/organisation.js`
- Test: `tests/domain/codes.test.js`, `tests/domain/organisation.test.js`

**Interfaces:**
- Produces :
  - `codes.js` : `ALPHABET: string`, `LONGUEUR_CODE = 8`, `genererCode(): string`, `genererCodes(n: number, deja?: Set<string>): string[]`, `formaterCode(code: string): string` (`ABCD-2345`), `normaliserCode(saisie: string): string | null`, `extraireCodeDepuisTexte(texte: string): string | null`.
  - `etats.js` : `ETATS: {value, label, ton}[]`, `libelleEtat(value): string`.
  - `permissions.js` : `peutEcrire(role): boolean`, `estAdmin(role): boolean`.
  - `organisation.js` : `choisirOrganisationActive(memberships, idMemorise): membership | null` avec `membership = { orgId, role, organisation: { id, nom, type } }`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`tests/domain/codes.test.js` :
```js
import { describe, it, expect } from 'vitest';
import {
  ALPHABET, genererCode, genererCodes, formaterCode, normaliserCode, extraireCodeDepuisTexte,
} from '../../src/domain/codes.js';

describe('genererCode', () => {
  it('produit 8 caractères de l\'alphabet sans ambiguïté', () => {
    for (let i = 0; i < 200; i++) {
      const c = genererCode();
      expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
    expect(ALPHABET).not.toMatch(/[01ILO]/);
  });
});

describe('genererCodes', () => {
  it('produit n codes tous distincts', () => {
    const codes = genererCodes(100);
    expect(codes).toHaveLength(100);
    expect(new Set(codes).size).toBe(100);
  });
  it('évite les codes déjà pris', () => {
    const deja = new Set(['AAAA2222']);
    const codes = genererCodes(50, deja);
    expect(codes).not.toContain('AAAA2222');
  });
});

describe('formaterCode / normaliserCode', () => {
  it('formate avec un tiret', () => {
    expect(formaterCode('ABCD2345')).toBe('ABCD-2345');
  });
  it('normalise minuscules, tirets et espaces', () => {
    expect(normaliserCode(' abcd-2345 ')).toBe('ABCD2345');
  });
  it('refuse un code trop court, trop long ou avec 0/O/1/I/L', () => {
    expect(normaliserCode('ABCD23')).toBeNull();
    expect(normaliserCode('ABCD234567')).toBeNull();
    expect(normaliserCode('ABCD234O')).toBeNull();
    expect(normaliserCode('ABCD2340')).toBeNull();
    expect(normaliserCode('')).toBeNull();
    expect(normaliserCode(null)).toBeNull();
  });
});

describe('extraireCodeDepuisTexte (revue focus 1)', () => {
  it('lit le code dans l\'adresse d\'une étiquette, quel que soit l\'hôte', () => {
    expect(extraireCodeDepuisTexte('https://logistecole.jfb4plai.com/o/ABCD2345')).toBe('ABCD2345');
    expect(extraireCodeDepuisTexte('http://localhost:5173/o/abcd-2345/')).toBe('ABCD2345');
  });
  it('accepte le code saisi à la main', () => {
    expect(extraireCodeDepuisTexte('abcd 2345')).toBe('ABCD2345');
  });
  it('refuse tout ce qui n\'est pas une étiquette Logistécole', () => {
    expect(extraireCodeDepuisTexte('https://exemple.be/produit/12')).toBeNull();
    expect(extraireCodeDepuisTexte('https://logistecole.jfb4plai.com/o/ABC')).toBeNull();
    expect(extraireCodeDepuisTexte('Bonjour')).toBeNull();
    expect(extraireCodeDepuisTexte('')).toBeNull();
    expect(extraireCodeDepuisTexte(undefined)).toBeNull();
  });
});
```

`tests/domain/organisation.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { choisirOrganisationActive } from '../../src/domain/organisation.js';
import { peutEcrire, estAdmin } from '../../src/domain/permissions.js';

const m = (id, role = 'gestionnaire') => ({ orgId: id, role, organisation: { id, nom: `Org ${id}`, type: 'ecole' } });

describe('choisirOrganisationActive (revue focus 3)', () => {
  it('renvoie null quand le compte n\'a aucune organisation', () => {
    expect(choisirOrganisationActive([], null)).toBeNull();
    expect(choisirOrganisationActive([], 'x')).toBeNull();
    expect(choisirOrganisationActive(undefined, null)).toBeNull();
  });
  it('reprend l\'organisation mémorisée si elle existe encore', () => {
    expect(choisirOrganisationActive([m('a'), m('b')], 'b').orgId).toBe('b');
  });
  it('retombe sur la première si la mémorisée n\'existe plus', () => {
    expect(choisirOrganisationActive([m('a'), m('b')], 'zzz').orgId).toBe('a');
  });
});

describe('permissions', () => {
  it('seuls admin et gestionnaire écrivent', () => {
    expect(peutEcrire('admin')).toBe(true);
    expect(peutEcrire('gestionnaire')).toBe(true);
    expect(peutEcrire('lecture')).toBe(false);
    expect(peutEcrire(null)).toBe(false);
  });
  it('seul admin administre', () => {
    expect(estAdmin('admin')).toBe(true);
    expect(estAdmin('gestionnaire')).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && npx vitest run tests/domain`
Expected : FAIL (modules introuvables).

- [ ] **Step 3 : Implémenter**

`src/domain/codes.js` :
```js
// Alphabet sans 0/O/1/I/L : lisible à l'œil et à la main sur une étiquette.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 8;

const VALIDE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

export function genererCode() {
  let out = '';
  while (out.length < LONGUEUR_CODE) {
    const octets = new Uint8Array(LONGUEUR_CODE * 2);
    globalThis.crypto.getRandomValues(octets);
    for (const b of octets) {
      // 248 = 31 * 8 : on écarte le reste pour éviter un biais modulo
      if (b < 248 && out.length < LONGUEUR_CODE) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export function genererCodes(n, deja = new Set()) {
  const pris = new Set(deja);
  const codes = [];
  while (codes.length < n) {
    const c = genererCode();
    if (!pris.has(c)) {
      pris.add(c);
      codes.push(c);
    }
  }
  return codes;
}

export function formaterCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normaliserCode(saisie) {
  if (typeof saisie !== 'string') return null;
  const c = saisie.toUpperCase().replace(/[\s-]/g, '');
  return VALIDE.test(c) ? c : null;
}

// Le QR contient une adresse /o/<code> ; on accepte aussi un code saisi à la main.
export function extraireCodeDepuisTexte(texte) {
  if (typeof texte !== 'string') return null;
  const t = texte.trim();
  const m = t.match(/\/o\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/);
  return normaliserCode(m ? m[1] : t);
}
```

`src/domain/etats.js` :
```js
export const ETATS = [
  { value: 'bon', label: 'Bon état', ton: 'ok' },
  { value: 'use', label: 'Usé', ton: 'attention' },
  { value: 'defectueux', label: 'Défectueux', ton: 'alerte' },
  { value: 'perdu', label: 'Perdu', ton: 'alerte' },
  { value: 'sorti', label: 'Sorti de l\'inventaire', ton: 'neutre' },
];

export function libelleEtat(value) {
  return ETATS.find((e) => e.value === value)?.label ?? value ?? '';
}
```

`src/domain/permissions.js` :
```js
export const peutEcrire = (role) => role === 'admin' || role === 'gestionnaire';
export const estAdmin = (role) => role === 'admin';
```

`src/domain/organisation.js` :
```js
// memberships : [{ orgId, role, organisation: { id, nom, type } }]
export function choisirOrganisationActive(memberships, idMemorise) {
  if (!Array.isArray(memberships) || memberships.length === 0) return null;
  return memberships.find((m) => m.orgId === idMemorise) ?? memberships[0];
}
```

- [ ] **Step 4 : Lancer, constater le succès**

Run : `npx vitest run tests/domain`
Expected : tous les tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add src tests && git commit -m "feat(domaine): codes courts, états, permissions, organisation active" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Domaine pur — lot, photo, erreurs, libellés d'historique, filtres

**Files:**
- Create: `src/domain/lot.js`, `src/domain/image.js`, `src/lib/erreurs.js`, `src/domain/historique.js`, `src/domain/filtres.js`
- Test: `tests/domain/lot.test.js`, `tests/domain/image.test.js`, `tests/domain/erreurs.test.js`, `tests/domain/historique.test.js`, `tests/domain/filtres.test.js`

**Interfaces:**
- Consumes : `libelleEtat` (Tâche 3).
- Produces :
  - `lot.js` : `MAX_LOT = 100`, `validerLot({ nom, quantite }): { ok: true, nom, quantite } | { ok: false, erreur }`.
  - `image.js` : `TAILLE_CIBLE`, `TAILLE_MAX_ORIGINE`, `calculerDimensions(largeur, hauteur, max?)`, `validerFichierPhoto(file): { ok, erreur? }`, `compresserImage(file): Promise<Blob>` (JPEG, navigateur uniquement, non testé en unitaire).
  - `erreurs.js` : `messageErreur(err): string`.
  - `historique.js` : `libelleEvenement(ev): string`.
  - `filtres.js` : `filtrerObjets(objets, { q, categorieId, emplacementId, etat }): objet[]` (cache `sorti` si `etat` vide).

- [ ] **Step 1 : Écrire les tests qui échouent**

`tests/domain/lot.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { validerLot, MAX_LOT } from '../../src/domain/lot.js';

describe('validerLot (revue focus 2)', () => {
  it('accepte un lot valide et nettoie le nom', () => {
    expect(validerLot({ nom: '  Tablette  ', quantite: '16' })).toEqual({ ok: true, nom: 'Tablette', quantite: 16 });
  });
  it('refuse une quantité hors 1..100, non entière ou vide', () => {
    for (const q of [0, -1, 101, 2.5, '', 'abc', null, undefined, NaN]) {
      expect(validerLot({ nom: 'Tablette', quantite: q }).ok).toBe(false);
    }
    expect(MAX_LOT).toBe(100);
    expect(validerLot({ nom: 'Tablette', quantite: 100 }).ok).toBe(true);
  });
  it('refuse un nom vide ou de plus de 120 caractères', () => {
    expect(validerLot({ nom: '   ', quantite: 1 }).ok).toBe(false);
    expect(validerLot({ nom: 'x'.repeat(121), quantite: 1 }).ok).toBe(false);
    expect(validerLot({ nom: 'x'.repeat(120), quantite: 1 }).ok).toBe(true);
  });
  it('donne un message lisible', () => {
    expect(validerLot({ nom: '', quantite: 1 }).erreur).toMatch(/nom/i);
    expect(validerLot({ nom: 'A', quantite: 101 }).erreur).toMatch(/100/);
  });
});
```

`tests/domain/image.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { calculerDimensions, validerFichierPhoto, TAILLE_MAX_ORIGINE } from '../../src/domain/image.js';

describe('calculerDimensions', () => {
  it('ne grandit jamais une petite image', () => {
    expect(calculerDimensions(800, 600, 1280)).toEqual({ largeur: 800, hauteur: 600 });
  });
  it('réduit en gardant les proportions', () => {
    expect(calculerDimensions(4000, 3000, 1280)).toEqual({ largeur: 1280, hauteur: 960 });
    expect(calculerDimensions(3000, 4000, 1280)).toEqual({ largeur: 960, hauteur: 1280 });
  });
});

describe('validerFichierPhoto (revue focus 4)', () => {
  const f = (type, size) => ({ type, size, name: 'x' });
  it('accepte une image raisonnable', () => {
    expect(validerFichierPhoto(f('image/jpeg', 3_000_000)).ok).toBe(true);
    expect(validerFichierPhoto(f('image/png', 100)).ok).toBe(true);
  });
  it('refuse un PDF, un fichier vide, ou une image trop lourde', () => {
    expect(validerFichierPhoto(f('application/pdf', 1000)).ok).toBe(false);
    expect(validerFichierPhoto(f('image/jpeg', 0)).ok).toBe(false);
    expect(validerFichierPhoto(f('image/jpeg', TAILLE_MAX_ORIGINE + 1)).ok).toBe(false);
    expect(validerFichierPhoto(null).ok).toBe(false);
  });
  it('explique le refus', () => {
    expect(validerFichierPhoto(f('application/pdf', 1000)).erreur).toMatch(/image/i);
  });
});
```

`tests/domain/erreurs.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { messageErreur } from '../../src/lib/erreurs.js';

describe('messageErreur', () => {
  it('traduit les erreurs de base de données courantes', () => {
    expect(messageErreur({ code: '23505' })).toMatch(/existe déjà/);
    expect(messageErreur({ code: '23503' })).toMatch(/encore utilisé/);
    expect(messageErreur({ code: '42501' })).toMatch(/pas le droit/);
  });
  it('traduit session expirée, réseau et limites', () => {
    expect(messageErreur({ message: 'JWT expired' })).toMatch(/session/i);
    expect(messageErreur(new TypeError('Failed to fetch'))).toMatch(/Connexion impossible/);
    expect(messageErreur({ status: 429 })).toMatch(/Patientez/);
  });
  it('laisse passer les messages français de nos propres règles', () => {
    expect(messageErreur({ code: 'P0001', message: 'Entre 1 et 100 objets par opération' })).toBe('Entre 1 et 100 objets par opération');
  });
  it('ne montre jamais de détail technique pour une erreur inconnue', () => {
    const m = messageErreur({ code: 'XX999', message: 'relation "logi_objets" does not exist' });
    expect(m).not.toMatch(/relation|logi_/);
    expect(messageErreur(undefined)).toMatch(/erreur/i);
  });
});
```

`tests/domain/historique.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { libelleEvenement } from '../../src/domain/historique.js';

describe('libelleEvenement', () => {
  it('décrit chaque type d\'événement', () => {
    expect(libelleEvenement({ type: 'creation', apres: 'Valise' })).toBe('Création de l\'objet « Valise »');
    expect(libelleEvenement({ type: 'deplacement', avant: 'Salle 12', apres: 'Armoire A' })).toBe('Déplacé de « Salle 12 » vers « Armoire A »');
    expect(libelleEvenement({ type: 'deplacement', avant: null, apres: 'Armoire A' })).toBe('Déplacé de « aucun emplacement » vers « Armoire A »');
    expect(libelleEvenement({ type: 'etat', avant: 'bon', apres: 'defectueux' })).toBe('État : Bon état → Défectueux');
    expect(libelleEvenement({ type: 'modification', commentaire: 'nom', avant: 'A', apres: 'B' })).toBe('Modification de « nom » : « A » → « B »');
    expect(libelleEvenement({ type: 'modification', commentaire: 'photo' })).toBe('Modification de « photo »');
    expect(libelleEvenement({ type: 'correction', commentaire: 'La salle est la 21' })).toBe('Correction : La salle est la 21');
    expect(libelleEvenement({ type: 'note', commentaire: 'Écran fissuré' })).toBe('Note : Écran fissuré');
  });
  it('ne plante pas sur un type inconnu', () => {
    expect(libelleEvenement({ type: 'futur' })).toBe('Événement');
  });
});
```

`tests/domain/filtres.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { filtrerObjets } from '../../src/domain/filtres.js';

const objets = [
  { id: 1, nom: 'Valise de tablettes', code: 'AAAA2222', etat: 'bon', categorie_id: 'c1', emplacement_id: 'e1', notes: '16 iPad' },
  { id: 2, nom: 'Projecteur numérique', code: 'BBBB3333', etat: 'defectueux', categorie_id: 'c2', emplacement_id: 'e2', notes: null },
  { id: 3, nom: 'Vieux globe', code: 'CCCC4444', etat: 'sorti', categorie_id: 'c2', emplacement_id: null, notes: null },
];

describe('filtrerObjets', () => {
  it('cache les objets sortis par défaut', () => {
    expect(filtrerObjets(objets).map((o) => o.id)).toEqual([1, 2]);
  });
  it('montre les sortis quand on les demande', () => {
    expect(filtrerObjets(objets, { etat: 'sorti' }).map((o) => o.id)).toEqual([3]);
  });
  it('cherche sans tenir compte des accents ni de la casse, dans nom, code et notes', () => {
    expect(filtrerObjets(objets, { q: 'NUMERIQUE' }).map((o) => o.id)).toEqual([2]);
    expect(filtrerObjets(objets, { q: 'tablettes' }).map((o) => o.id)).toEqual([1]);
    expect(filtrerObjets(objets, { q: 'ipad' }).map((o) => o.id)).toEqual([1]);
    expect(filtrerObjets(objets, { q: 'bbbb-3333' }).map((o) => o.id)).toEqual([2]);
  });
  it('combine catégorie et emplacement', () => {
    expect(filtrerObjets(objets, { categorieId: 'c2' }).map((o) => o.id)).toEqual([2]);
    expect(filtrerObjets(objets, { emplacementId: 'e1' }).map((o) => o.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/domain`
Expected : FAIL sur les 5 nouveaux fichiers.

- [ ] **Step 3 : Implémenter**

`src/domain/lot.js` :
```js
export const MAX_LOT = 100;

export function validerLot({ nom, quantite }) {
  const n = String(nom ?? '').trim();
  if (n.length === 0) return { ok: false, erreur: 'Le nom est obligatoire.' };
  if (n.length > 120) return { ok: false, erreur: 'Le nom est trop long (120 caractères au maximum).' };
  const q = typeof quantite === 'number' ? quantite : Number(String(quantite ?? '').trim() === '' ? NaN : quantite);
  if (!Number.isInteger(q) || q < 1 || q > MAX_LOT) {
    return { ok: false, erreur: `La quantité doit être un nombre entier entre 1 et ${MAX_LOT}.` };
  }
  return { ok: true, nom: n, quantite: q };
}
```

`src/domain/image.js` :
```js
export const TAILLE_CIBLE = 200 * 1024; // objectif après compression
export const TAILLE_MAX_ORIGINE = 15 * 1024 * 1024; // refus avant même de compresser

export function calculerDimensions(largeur, hauteur, max = 1280) {
  const plusGrand = Math.max(largeur, hauteur);
  if (plusGrand <= max) return { largeur, hauteur };
  const f = max / plusGrand;
  return { largeur: Math.round(largeur * f), hauteur: Math.round(hauteur * f) };
}

export function validerFichierPhoto(file) {
  if (!file || !file.size) return { ok: false, erreur: 'Aucun fichier choisi.' };
  if (!String(file.type).startsWith('image/')) {
    return { ok: false, erreur: 'Le fichier doit être une image (photo ou capture d\'écran).' };
  }
  if (file.size > TAILLE_MAX_ORIGINE) {
    return { ok: false, erreur: 'Cette image est trop lourde (15 Mo au maximum). Prenez-la en plus petit.' };
  }
  return { ok: true };
}

async function versBlob(bitmap, max, qualite) {
  const { largeur, hauteur } = calculerDimensions(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, largeur, hauteur);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', qualite));
}

// Navigateur uniquement : JPEG ≤ ~200 Ko, côté le plus long ≤ 1280 px.
export async function compresserImage(file) {
  const bitmap = await createImageBitmap(file);
  let max = 1280;
  let blob;
  for (let essai = 0; essai < 4; essai++) {
    for (const q of [0.7, 0.55, 0.4]) {
      blob = await versBlob(bitmap, max, q);
      if (blob.size <= TAILLE_CIBLE) return blob;
    }
    max = Math.round(max * 0.75);
  }
  return blob;
}
```

`src/lib/erreurs.js` :
```js
// Jamais de détail technique pour l'utilisateur.
export function messageErreur(err) {
  const code = err?.code ?? err?.status;
  const msg = String(err?.message ?? '');
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Connexion impossible. Vérifiez le réseau et réessayez. Rien n\'a été enregistré.';
  }
  if (code === 'PGRST301' || code === 401 || /jwt/i.test(msg)) return 'Votre session a expiré. Reconnectez-vous.';
  if (code === 429 || code === 'over_email_send_rate_limit') return 'Trop de demandes. Patientez quelques minutes.';
  if (code === '23505') return 'Ce code ou ce nom existe déjà. Réessayez.';
  if (code === '23503') return 'Impossible : cet élément est encore utilisé ailleurs.';
  if (code === '42501' || code === 403) return 'Vous n\'avez pas le droit de faire cette action.';
  // Règles métier écrites en français dans la base (raise exception).
  if (code === 'P0001' && msg) return msg;
  return 'Une erreur est survenue. Réessayez ; si cela continue, prévenez l\'administrateur.';
}
```

`src/domain/historique.js` :
```js
import { libelleEtat } from './etats.js';

export function libelleEvenement(ev) {
  switch (ev.type) {
    case 'creation':
      return `Création de l'objet « ${ev.apres} »`;
    case 'deplacement':
      return `Déplacé de « ${ev.avant ?? 'aucun emplacement'} » vers « ${ev.apres ?? 'aucun emplacement'} »`;
    case 'etat':
      return `État : ${libelleEtat(ev.avant)} → ${libelleEtat(ev.apres)}`;
    case 'modification':
      return ev.avant != null || ev.apres != null
        ? `Modification de « ${ev.commentaire} » : « ${ev.avant ?? ''} » → « ${ev.apres ?? ''} »`
        : `Modification de « ${ev.commentaire} »`;
    case 'correction':
      return `Correction : ${ev.commentaire}`;
    case 'note':
      return `Note : ${ev.commentaire}`;
    default:
      return 'Événement';
  }
}
```

`src/domain/filtres.js` :
```js
const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filtrerObjets(objets, { q = '', categorieId = '', emplacementId = '', etat = '' } = {}) {
  const n = sansAccent(q).trim();
  const nCode = n.replace(/[\s-]/g, '');
  return objets.filter((o) => {
    if (etat ? o.etat !== etat : o.etat === 'sorti') return false;
    if (categorieId && o.categorie_id !== categorieId) return false;
    if (emplacementId && o.emplacement_id !== emplacementId) return false;
    if (n) {
      const texte = sansAccent(`${o.nom} ${o.code} ${o.notes ?? ''}`);
      if (!texte.includes(n) && !(nCode && sansAccent(o.code).includes(nCode))) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4 : Lancer, constater le succès**

Run : `npx vitest run tests/domain`
Expected : tout PASS (corriger l'implémentation, pas les tests, si un cas échoue).

- [ ] **Step 5 : Commit**

```bash
git add src tests && git commit -m "feat(domaine): validation de lot et de photo, messages d'erreur, historique, filtres" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Socle client — Supabase, auth, organisation active, coque, connexion

**Files:**
- Create: `src/lib/supabase.js`, `src/lib/auth.jsx`, `src/lib/org.jsx`, `src/lib/queryClient.js`, `src/components/Nav.jsx`, `src/components/Footer.jsx`, `src/components/RequireAuth.jsx`, `src/components/ChampGuide.jsx`, `src/components/EtatBadge.jsx`, `src/pages/Connexion.jsx`, `src/pages/AucuneOrganisation.jsx`, `src/logistecole.css`, `public/icon.svg`, `public/manifest.webmanifest`
- Modify: `src/main.jsx`, `src/App.jsx`
- Test: `tests/components/ChampGuide.test.jsx`, `tests/components/EtatBadge.test.jsx`, `tests/components/AucuneOrganisation.test.jsx`

**Interfaces:**
- Consumes : `choisirOrganisationActive`, `libelleEtat`, `ETATS`, `estAdmin` (Tâche 3).
- Produces :
  - `useAuth(): { session, ready }`, `AuthProvider`.
  - `useOrg(): { memberships, active, role, orgId, orgNom, choisir(id), loading, error }`, `OrgProvider`.
  - `<ChampGuide id label aide obligatoire>{input}</ChampGuide>` (l'input reçoit `aria-describedby={`${id}-aide`}`).
  - `<EtatBadge etat="bon" />`.
  - `<RequireAuth />` : route layout (Nav + Outlet + Footer), redirige vers `/connexion`.
  - Routes (App) : `/connexion`, `/`, `/o/:code`, `/o/:code/modifier`, `/nouveau`, `/scan`, `/etiquettes`, `/admin` ; pages encore inexistantes remplacées par un composant provisoire `À venir` jusqu'à leurs tâches.

- [ ] **Step 1 : Écrire les tests de composants qui échouent**

`tests/components/ChampGuide.test.jsx` :
```jsx
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
```

`tests/components/EtatBadge.test.jsx` :
```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EtatBadge from '../../src/components/EtatBadge.jsx';

describe('EtatBadge', () => {
  it('affiche toujours un mot, pas seulement une couleur', () => {
    render(<EtatBadge etat="defectueux" />);
    expect(screen.getByText('Défectueux')).toBeInTheDocument();
  });
});
```

`tests/components/AucuneOrganisation.test.jsx` :
```jsx
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
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/components`
Expected : FAIL (modules introuvables).

- [ ] **Step 3 : Implémenter les briques**

`src/lib/supabase.js` :
```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants (voir .env.example)');
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

`src/lib/queryClient.js` :
```js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 15_000 } },
});
```

`src/lib/auth.jsx` :
```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session, ready }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
```

`src/lib/org.jsx` :
```jsx
import { createContext, useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase.js';
import { useAuth } from './auth.jsx';
import { choisirOrganisationActive } from '../domain/organisation.js';

const OrgCtx = createContext(null);
const CLE = 'logi_org_active';

function lire() {
  try { return localStorage.getItem(CLE); } catch { return null; }
}
function ecrire(v) {
  try { localStorage.setItem(CLE, v); } catch { /* stockage indisponible : on continue sans */ }
}

export function OrgProvider({ children }) {
  const { session, ready } = useAuth();
  const [idChoisi, setIdChoisi] = useState(lire);

  const { data, isLoading, error } = useQuery({
    queryKey: ['memberships', session?.user?.id],
    enabled: ready && !!session,
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('logi_membres')
        .select('org_id, role, logi_organisations(id, nom, type)')
        .eq('user_id', session.user.id);
      if (err) throw err;
      return rows.map((m) => ({ orgId: m.org_id, role: m.role, organisation: m.logi_organisations }));
    },
  });

  const memberships = data ?? [];
  const active = choisirOrganisationActive(memberships, idChoisi);
  const choisir = (id) => { setIdChoisi(id); ecrire(id); };

  const value = {
    memberships,
    active,
    role: active?.role ?? null,
    orgId: active?.orgId ?? null,
    orgNom: active?.organisation?.nom ?? '',
    choisir,
    loading: !ready || (!!session && isLoading),
    error,
  };
  return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgCtx);
  if (!ctx) throw new Error('useOrg hors OrgProvider');
  return ctx;
}
```

`src/components/ChampGuide.jsx` :
```jsx
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
```

`src/components/EtatBadge.jsx` :
```jsx
import { ETATS } from '../domain/etats.js';

export default function EtatBadge({ etat }) {
  const e = ETATS.find((x) => x.value === etat);
  return <span className={`badge-etat badge-${e?.ton ?? 'neutre'}`}>{e?.label ?? etat}</span>;
}
```

`src/pages/AucuneOrganisation.jsx` :
```jsx
export default function AucuneOrganisation() {
  return (
    <section className="plai-card carte-info">
      <h1>Votre compte n'est pas encore rattaché à une organisation</h1>
      <p>
        Vous êtes bien connecté·e, mais aucune école ni aucun Pôle ne vous a encore donné accès à son matériel.
        Demandez à l'administrateur de votre organisation de vous inviter avec votre adresse e-mail.
      </p>
      <p>
        Une question ? Écrivez à <a href="mailto:jf.beguin@outlook.com">jf.beguin@outlook.com</a>.
      </p>
    </section>
  );
}
```

`src/components/Footer.jsx` :
```jsx
export default function Footer() {
  return (
    <footer className="plai-footer">
      <img src="/plai-logo.jpg" alt="PLAI" className="logo-footer" />
      <p>Logistécole, un outil du PLAI : gratuit pour les écoles.</p>
      <p>Contact : <a href="mailto:jf.beguin@outlook.com">jf.beguin@outlook.com</a></p>
    </footer>
  );
}
```

`src/components/Nav.jsx` :
```jsx
import { NavLink, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useOrg } from '../lib/org.jsx';
import { estAdmin, peutEcrire } from '../domain/permissions.js';

export default function Nav() {
  const { memberships, orgId, orgNom, role, choisir } = useOrg();
  return (
    <header className="plai-nav nav-logi">
      <Link to="/" className="plai-nav-logo">
        <img src="/plai-logo.jpg" alt="PLAI" className="logo-nav" />
        <span>Logistécole</span>
      </Link>
      <div className="plai-nav-actions">
        {memberships.length > 1 ? (
          <select aria-label="Organisation" className="plai-input select-org" value={orgId ?? ''} onChange={(e) => choisir(e.target.value)}>
            {memberships.map((m) => <option key={m.orgId} value={m.orgId}>{m.organisation.nom}</option>)}
          </select>
        ) : (
          <span className="nom-org">{orgNom}</span>
        )}
        <button type="button" className="plai-nav-link" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </div>
      <nav className="onglets" aria-label="Navigation principale">
        <NavLink to="/" end>Matériel</NavLink>
        <NavLink to="/scan">Scanner</NavLink>
        <NavLink to="/etiquettes">Étiquettes</NavLink>
        {peutEcrire(role) && <NavLink to="/nouveau">Ajouter</NavLink>}
        {estAdmin(role) && <NavLink to="/admin">Administration</NavLink>}
      </nav>
    </header>
  );
}
```

`src/components/RequireAuth.jsx` :
```jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import { messageErreur } from '../lib/erreurs.js';
import Nav from './Nav.jsx';
import Footer from './Footer.jsx';
import AucuneOrganisation from '../pages/AucuneOrganisation.jsx';

export default function RequireAuth() {
  const { session, ready } = useAuth();
  const { loading, memberships, error } = useOrg();
  const loc = useLocation();

  if (!ready) return <p className="chargement">Chargement…</p>;
  if (!session) return <Navigate to="/connexion" replace state={{ from: loc.pathname + loc.search }} />;

  let contenu;
  if (loading) contenu = <p className="chargement">Chargement…</p>;
  else if (error) contenu = <p className="plai-error" role="alert">{messageErreur(error)}</p>;
  else if (memberships.length === 0) contenu = <AucuneOrganisation />;
  else contenu = <Outlet />;

  return (
    <>
      <Nav />
      <main className="plai-container page">{contenu}</main>
      <Footer />
    </>
  );
}
```

`src/pages/Connexion.jsx` :
```jsx
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';
import Footer from '../components/Footer.jsx';

export default function Connexion() {
  const { session, ready } = useAuth();
  const loc = useLocation();
  const from = loc.state?.from ?? '/';
  const [email, setEmail] = useState('');
  const [etat, setEtat] = useState({ envoi: false, ok: false, erreur: '' });

  if (ready && session) return <Navigate to={from} replace />;

  async function envoyer(e) {
    e.preventDefault();
    setEtat({ envoi: true, ok: false, erreur: '' });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + from },
    });
    // Message identique que l'adresse soit connue ou non : on ne révèle pas qui a un compte.
    const inconnu = error && (error.status === 400 || /signups not allowed|not found/i.test(error.message ?? ''));
    if (error && !inconnu) setEtat({ envoi: false, ok: false, erreur: messageErreur(error) });
    else setEtat({ envoi: false, ok: true, erreur: '' });
  }

  return (
    <>
      <main className="plai-container page page-connexion">
        <img src="/plai-logo.jpg" alt="PLAI" className="logo-connexion" />
        <h1>Logistécole</h1>
        <p className="accroche">Le matériel de votre école, retrouvé en deux scans. Gratuit pour les écoles.</p>
        <form className="plai-card" onSubmit={envoyer}>
          <ChampGuide
            id="email"
            label="Votre adresse e-mail"
            aide="Vous recevez un lien de connexion à cette adresse, sans mot de passe à retenir. Il faut avoir été invité·e par l'administrateur de votre école ou du Pôle."
            obligatoire
          >
            <input
              id="email" type="email" required autoComplete="email" className="plai-input"
              placeholder="prenom.nom@ecole-liege.be" aria-describedby="email-aide"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </ChampGuide>
          {etat.erreur && <p className="plai-error" role="alert">{etat.erreur}</p>}
          {etat.ok && (
            <p className="plai-success" role="status">
              Si cette adresse est autorisée, un lien de connexion vient d'être envoyé. Ouvrez-le sur cet appareil. Pensez à regarder les courriers indésirables.
            </p>
          )}
          <button className="plai-btn" disabled={etat.envoi}>{etat.envoi ? 'Envoi…' : 'Recevoir mon lien de connexion'}</button>
        </form>
      </main>
      <Footer />
    </>
  );
}
```

`src/App.jsx` :
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import Connexion from './pages/Connexion.jsx';

const AVenir = ({ nom }) => <p className="plai-empty">{nom} : bientôt.</p>;

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<AVenir nom="Liste du matériel" />} />
        <Route path="/o/:code" element={<AVenir nom="Fiche" />} />
        <Route path="/o/:code/modifier" element={<AVenir nom="Modification" />} />
        <Route path="/nouveau" element={<AVenir nom="Ajout" />} />
        <Route path="/scan" element={<AVenir nom="Scan" />} />
        <Route path="/etiquettes" element={<AVenir nom="Étiquettes" />} />
        <Route path="/admin" element={<AVenir nom="Administration" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

`src/main.jsx` :
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { AuthProvider } from './lib/auth.jsx';
import { OrgProvider } from './lib/org.jsx';
import App from './App.jsx';
import './plai-style.css';
import './logistecole.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <App />
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

`public/icon.svg` :
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f6e56"/>
  <rect x="96" y="96" width="140" height="140" rx="16" fill="#fff"/>
  <rect x="276" y="96" width="140" height="140" rx="16" fill="#fff"/>
  <rect x="96" y="276" width="140" height="140" rx="16" fill="#fff"/>
  <rect x="136" y="136" width="60" height="60" rx="8" fill="#0f6e56"/>
  <rect x="316" y="136" width="60" height="60" rx="8" fill="#0f6e56"/>
  <rect x="136" y="316" width="60" height="60" rx="8" fill="#0f6e56"/>
  <circle cx="346" cy="346" r="70" fill="#f97316"/>
</svg>
```

`public/manifest.webmanifest` :
```json
{
  "name": "Logistécole",
  "short_name": "Logistécole",
  "description": "Gestion gratuite du matériel des écoles",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf9f7",
  "theme_color": "#0f6e56",
  "icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }]
}
```

`src/logistecole.css` (surcharge de `plai-style.css`, accessibilité et charte attrayante) :
```css
:root { --orange: #f97316; --orange-bg: #fff3e8; --teal-dark: #0a5441; }

body { font-size: 16px; line-height: 1.6; }
h1 { font-family: 'DM Serif Display', serif; font-size: 28px; line-height: 1.2; margin: 0.5rem 0 0.75rem; color: var(--teal-dark); }
h2 { font-family: 'DM Serif Display', serif; font-size: 22px; margin: 1.25rem 0 0.75rem; }
a { color: var(--teal); }
:focus-visible { outline: 3px solid var(--orange); outline-offset: 2px; }

.page { padding-top: 1.25rem; padding-bottom: 2rem; min-height: 60vh; }
.chargement { padding: 2rem 0; color: var(--text2); }
.accroche { color: var(--text2); margin-bottom: 1.25rem; }
.carte-info { margin-top: 1.5rem; }

/* Nav : logo à hauteur fixe, largeur automatique (logo non carré) */
.nav-logi { height: auto; flex-wrap: wrap; padding: 6px 1rem 0; gap: 4px 12px; border-bottom: 3px solid var(--teal); }
.logo-nav { height: 32px; width: auto; }
.logo-footer { height: 40px; width: auto; margin-bottom: 8px; }
.logo-connexion { height: 48px; width: auto; margin: 1.5rem 0 0.5rem; }
.plai-nav-link { font-size: 16px; min-height: 44px; padding: 8px 12px; }
.nom-org { font-size: 16px; font-weight: 700; color: var(--teal-dark); }
.select-org { width: auto; max-width: 220px; }
.onglets { display: flex; gap: 4px; width: 100%; overflow-x: auto; padding-bottom: 6px; }
.onglets a {
  font-size: 16px; font-weight: 500; text-decoration: none; color: var(--text2);
  padding: 10px 14px; min-height: 44px; border-radius: 8px 8px 0 0; white-space: nowrap;
}
.onglets a.active { background: var(--teal); color: #fff; }

/* Boutons et champs : 44 px minimum, 16 px minimum */
.plai-btn, .plai-btn-ghost { font-size: 16px; min-height: 44px; padding: 10px 20px; }
.plai-input { font-size: 16px; min-height: 44px; }
.plai-label { font-size: 16px; font-weight: 700; color: var(--text); }
.champ-aide { font-size: 16px; color: var(--text2); margin-top: 4px; line-height: 1.5; }
.plai-error, .plai-success { font-size: 16px; }
.btn-orange { background: var(--orange); color: #fff; }
.btn-scan {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  background: var(--orange); color: #fff; text-decoration: none; font-weight: 700; font-size: 18px;
  min-height: 56px; border-radius: var(--radius); margin-bottom: 1rem;
}
.btn-danger { background: #a32d2d; color: #fff; border: none; border-radius: var(--radius-sm); min-height: 44px; padding: 10px 20px; font-size: 16px; cursor: pointer; }

/* Pastilles d'état : couleur + mot */
.badge-etat { display: inline-block; font-size: 16px; font-weight: 700; padding: 2px 12px; border-radius: 20px; border: 2px solid; }
.badge-ok { color: var(--teal-dark); background: var(--teal-bg); border-color: var(--teal-border); }
.badge-attention { color: #8a4b00; background: var(--orange-bg); border-color: var(--orange); }
.badge-alerte { color: #a32d2d; background: #fcebeb; border-color: #e24b4a; }
.badge-neutre { color: var(--text2); background: var(--surface2); border-color: var(--border2); }

/* Liste de matériel */
.bandeau { background: linear-gradient(135deg, var(--teal) 0%, #1d9e75 100%); color: #fff; border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1rem; }
.bandeau h1 { color: #fff; margin: 0; }
.filtres { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-bottom: 1rem; }
.liste-objets { list-style: none; display: grid; gap: 8px; }
.ligne-objet { display: flex; gap: 12px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; text-decoration: none; color: var(--text); min-height: 72px; }
.ligne-objet:hover { border-color: var(--teal); }
.vignette { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; background: var(--surface2); flex: none; }
.vignette-vide { display: flex; align-items: center; justify-content: center; color: var(--text3); font-size: 16px; }
.ligne-texte { flex: 1; min-width: 0; }
.ligne-texte strong { display: block; overflow-wrap: anywhere; }
.meta { color: var(--text2); font-size: 16px; }
.code-court { font-family: ui-monospace, Consolas, monospace; font-weight: 700; letter-spacing: 1px; }
.encart-avenir { background: var(--orange-bg); border: 1px solid var(--orange); border-radius: var(--radius); padding: 1rem 1.25rem; margin-top: 1.5rem; }
.encart-avenir h2 { margin-top: 0; }

/* Fiche */
.fiche-photo { width: 100%; max-height: 320px; object-fit: cover; border-radius: var(--radius); margin-bottom: 1rem; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 1rem 0; }
.bloc-action { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.bloc-action .plai-input { flex: 1; min-width: 180px; }
.historique { list-style: none; border-left: 3px solid var(--teal-border); padding-left: 14px; }
.historique li { margin-bottom: 12px; }
.historique time, .historique .auteur { color: var(--text2); font-size: 16px; display: block; }
.btn-lien { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 20px; text-decoration: none; }

/* Scan */
.scan-video { width: 100%; max-height: 60vh; background: #000; border-radius: var(--radius); }
.scan-manuel { margin-top: 1rem; }

/* Étiquettes et admin */
.liste-cases { list-style: none; display: grid; gap: 6px; }
.liste-cases label { display: flex; gap: 10px; align-items: center; min-height: 44px; }
.liste-cases input[type="checkbox"] { width: 24px; height: 24px; }
.onglets-admin { display: flex; gap: 8px; margin-bottom: 1rem; flex-wrap: wrap; }
.tableau { width: 100%; border-collapse: collapse; }
.tableau th, .tableau td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); font-size: 16px; }
.page-connexion { max-width: 520px; }
```

- [ ] **Step 4 : Lancer tests et build**

Run : `cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && npx vitest run && VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite build`
Expected : tests PASS, build OK.

- [ ] **Step 5 : Poser les variables locales et vérifier la connexion dans le navigateur**

Créer `.env.local` (non versionné) : demander à JF de coller `VITE_SUPABASE_ANON_KEY` ou le lire dans `AmenagActif\.env*` s'il existe (même projet partagé). Ne jamais afficher la clé dans la conversation.
Créer `.claude/launch.json` si absent :
```json
{ "version": "0.0.1", "configurations": [{ "name": "logistecole", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }] }
```
Puis `preview_start` (`name: "logistecole"`), ouvrir `/`. Expected : redirection vers `/connexion`, logo PLAI non déformé (hauteur 48 px, largeur auto), formulaire avec label, placeholder, aide ; aucune erreur dans `read_console_messages`. Lire les valeurs réelles : `javascript_tool` → `getComputedStyle(document.querySelector('input')).fontSize` doit valoir `16px` et la hauteur ≥ 44.

- [ ] **Step 6 : Commit**

```bash
git add -A && git commit -m "feat: coque, auth par lien, organisation active, charte" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Couche données et liste du matériel

**Files:**
- Create: `src/data/objets.js`, `src/data/referentiels.js`, `src/data/hooks.js`, `src/pages/Accueil.jsx`
- Modify: `src/App.jsx` (route `/`)

**Interfaces:**
- Consumes : `supabase`, `useOrg`, `filtrerObjets`, `EtatBadge`, `peutEcrire`, `formaterCode`.
- Produces (`data/objets.js`) :
  - `listerObjets(orgId): Promise<Objet[]>`, `getObjetParCode(code): Promise<Objet | null>`
  - `creerObjets(orgId, objets: {nom, categorie_id?, emplacement_id?, etat?, photo_path?, notes?, code}[]): Promise<{objet_id, objet_code}[]>`
  - `modifierObjet(id, champs): Promise<void>`, `supprimerObjet(id): Promise<void>`
  - `listerHistorique(objetId): Promise<Evenement[]>`, `ajouterEntreeHistorique({ objetId, orgId, type: 'correction'|'note', commentaire }): Promise<void>`
  - `uploaderPhoto(orgId, blob): Promise<string>` (chemin), `supprimerPhoto(path)`, `urlsPhotos(paths: string[]): Promise<Record<string, string>>`
- Produces (`data/referentiels.js`) : `listerReferentiel(table, orgId)`, `ajouterReferentiel(table, orgId, nom, parentId?)`, `renommerReferentiel(table, id, nom)`, `supprimerReferentiel(table, id)` avec `table ∈ {'logi_emplacements','logi_categories'}`.
- Produces (`data/hooks.js`) : `useObjets(orgId)`, `useCategories(orgId)`, `useEmplacements(orgId)`, `usePhotos(objets)` → `Record<path, url>`.
- Forme d'un `Objet` : `{ id, org_id, nom, code, etat, notes, photo_path, categorie_id, emplacement_id, cree_le, maj_le, logi_categories: {nom}|null, logi_emplacements: {nom}|null }`.

- [ ] **Step 1 : Écrire la couche données**

`src/data/objets.js` :
```js
import { supabase } from '../lib/supabase.js';

const COLONNES =
  'id, org_id, nom, code, etat, notes, photo_path, categorie_id, emplacement_id, cree_le, maj_le, logi_categories(nom), logi_emplacements(nom)';
const BUCKET = 'logi-photos';

function verifier(error) {
  if (error) throw error;
}

export async function listerObjets(orgId) {
  const { data, error } = await supabase.from('logi_objets').select(COLONNES).eq('org_id', orgId).order('nom');
  verifier(error);
  return data;
}

export async function getObjetParCode(code) {
  const { data, error } = await supabase.from('logi_objets').select(COLONNES).eq('code', code).maybeSingle();
  verifier(error);
  return data;
}

export async function creerObjets(orgId, objets) {
  const { data, error } = await supabase.rpc('logi_creer_objets', { p_org: orgId, p_objets: objets });
  verifier(error);
  return data;
}

export async function modifierObjet(id, champs) {
  const { error } = await supabase.from('logi_objets').update(champs).eq('id', id);
  verifier(error);
}

export async function supprimerObjet(id) {
  const { error } = await supabase.from('logi_objets').delete().eq('id', id);
  verifier(error);
}

export async function listerHistorique(objetId) {
  const { data, error } = await supabase
    .from('logi_historique')
    .select('id, type, avant, apres, commentaire, quand, auteur_email')
    .eq('objet_id', objetId)
    .order('quand', { ascending: false })
    .order('id', { ascending: false });
  verifier(error);
  return data;
}

export async function ajouterEntreeHistorique({ objetId, orgId, type, commentaire }) {
  const { error } = await supabase
    .from('logi_historique')
    .insert({ objet_id: objetId, org_id: orgId, type, commentaire });
  verifier(error);
}

export async function uploaderPhoto(orgId, blob) {
  const path = `${orgId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  verifier(error);
  return path;
}

export async function supprimerPhoto(path) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function urlsPhotos(paths) {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  verifier(error);
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
```

`src/data/referentiels.js` :
```js
import { supabase } from '../lib/supabase.js';

const TABLES = ['logi_emplacements', 'logi_categories'];
function table(t) {
  if (!TABLES.includes(t)) throw new Error('Table inconnue');
  return supabase.from(t);
}
function verifier(error) {
  if (error) throw error;
}

export async function listerReferentiel(t, orgId) {
  const cols = t === 'logi_emplacements' ? 'id, nom, parent_id' : 'id, nom';
  const { data, error } = await table(t).select(cols).eq('org_id', orgId).order('nom');
  verifier(error);
  return data;
}

export async function ajouterReferentiel(t, orgId, nom, parentId = null) {
  const ligne = { org_id: orgId, nom: nom.trim() };
  if (t === 'logi_emplacements') ligne.parent_id = parentId || null;
  const { error } = await table(t).insert(ligne);
  verifier(error);
}

export async function renommerReferentiel(t, id, nom) {
  const { error } = await table(t).update({ nom: nom.trim() }).eq('id', id);
  verifier(error);
}

export async function supprimerReferentiel(t, id) {
  const { error } = await table(t).delete().eq('id', id);
  verifier(error);
}
```

`src/data/hooks.js` :
```js
import { useQuery } from '@tanstack/react-query';
import { listerObjets, urlsPhotos } from './objets.js';
import { listerReferentiel } from './referentiels.js';

export const useObjets = (orgId) =>
  useQuery({ queryKey: ['objets', orgId], enabled: !!orgId, queryFn: () => listerObjets(orgId) });

export const useCategories = (orgId) =>
  useQuery({ queryKey: ['categories', orgId], enabled: !!orgId, queryFn: () => listerReferentiel('logi_categories', orgId) });

export const useEmplacements = (orgId) =>
  useQuery({ queryKey: ['emplacements', orgId], enabled: !!orgId, queryFn: () => listerReferentiel('logi_emplacements', orgId) });

export function usePhotos(objets) {
  const paths = [...new Set((objets ?? []).map((o) => o.photo_path).filter(Boolean))].sort();
  const { data } = useQuery({
    queryKey: ['photos', paths.join('|')],
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: () => urlsPhotos(paths),
  });
  return data ?? {};
}
```

- [ ] **Step 2 : Écrire la page d'accueil**

`src/pages/Accueil.jsx` :
```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets, useCategories, useEmplacements, usePhotos } from '../data/hooks.js';
import { filtrerObjets } from '../domain/filtres.js';
import { ETATS } from '../domain/etats.js';
import { formaterCode } from '../domain/codes.js';
import { peutEcrire } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';

export default function Accueil() {
  const { orgId, orgNom, role } = useOrg();
  const objetsQ = useObjets(orgId);
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];
  const photos = usePhotos(objetsQ.data);
  const [f, setF] = useState({ q: '', categorieId: '', emplacementId: '', etat: '' });
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const tous = objetsQ.data ?? [];
  const visibles = filtrerObjets(tous, f);

  return (
    <>
      <div className="bandeau"><h1>{orgNom}</h1><p>{tous.filter((o) => o.etat !== 'sorti').length} objet(s) dans l'inventaire</p></div>
      <Link to="/scan" className="btn-scan">Scanner une étiquette</Link>

      <div className="filtres">
        <input className="plai-input" type="search" aria-label="Rechercher" placeholder="Rechercher : tablette, projecteur, ABCD-2345…" value={f.q} onChange={maj('q')} />
        <select className="plai-input" aria-label="Catégorie" value={f.categorieId} onChange={maj('categorieId')}>
          <option value="">Toutes les catégories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select className="plai-input" aria-label="Emplacement" value={f.emplacementId} onChange={maj('emplacementId')}>
          <option value="">Tous les emplacements</option>
          {emps.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select className="plai-input" aria-label="État" value={f.etat} onChange={maj('etat')}>
          <option value="">Tous les états (hors sortis)</option>
          {ETATS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      {objetsQ.isLoading && <p className="chargement">Chargement du matériel…</p>}
      {objetsQ.error && <p className="plai-error" role="alert">{messageErreur(objetsQ.error)}</p>}
      {!objetsQ.isLoading && !objetsQ.error && tous.length === 0 && (
        <div className="plai-empty">
          Aucun matériel pour l'instant.
          {peutEcrire(role) && <p><Link className="plai-btn btn-lien" to="/nouveau">Ajouter le premier objet</Link></p>}
        </div>
      )}
      {tous.length > 0 && visibles.length === 0 && <p className="plai-empty">Aucun objet ne correspond à ces filtres.</p>}

      <ul className="liste-objets">
        {visibles.map((o) => (
          <li key={o.id}>
            <Link to={`/o/${o.code}`} className="ligne-objet">
              {o.photo_path && photos[o.photo_path]
                ? <img className="vignette" src={photos[o.photo_path]} alt="" />
                : <span className="vignette vignette-vide" aria-hidden="true">Photo</span>}
              <span className="ligne-texte">
                <strong>{o.nom}</strong>
                <span className="meta">{o.logi_emplacements?.nom ?? 'Sans emplacement'} · <span className="code-court">{formaterCode(o.code)}</span></span>
              </span>
              <EtatBadge etat={o.etat} />
            </Link>
          </li>
        ))}
      </ul>

      <aside className="encart-avenir">
        <h2>Ce que Logistécole ne fait pas encore</h2>
        <p>
          Pour l'instant : inventaire, emplacements, historique, QR codes et étiquettes. Pas encore de prêts, de réservations,
          de notifications, ni de mode hors ligne : il faut du réseau pour enregistrer. Les prêts arrivent ensuite.
        </p>
      </aside>
    </>
  );
}
```

`src/App.jsx` : remplacer la route `/` par `<Accueil />` (import `./pages/Accueil.jsx`).

- [ ] **Step 3 : Build et tests**

Run : `npx vitest run && npx vite build`
Expected : PASS, build OK.

- [ ] **Step 4 : Vérifier avec de vraies données (après accord de JF pour la création de l'organisation de test)**

Avec l'accord de JF (création de données réelles dans la base partagée), exécuter dans le SQL Editor, en remplaçant `<UUID_JF>` par l'identifiant du compte de JF (visible dans Authentication > Users) :
```sql
select logi_nouvelle_organisation('Pôle PLAI (essai)', 'pole', '<UUID_JF>');
```
Puis se connecter à `http://localhost:5173` (lien reçu par e-mail ; l'URL `http://localhost:5173/**` doit être dans les Redirect URLs Supabase, voir Tâche 13 step 3). Lire dans la page : le nom de l'organisation, « 0 objet », les 8 catégories dans le filtre (`read_page`). Expected : aucune erreur console, état vide avec lien « Ajouter le premier objet » si le rôle est admin.

- [ ] **Step 5 : Commit**

```bash
git add -A && git commit -m "feat: couche données et liste du matériel avec filtres" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Fiche d'un objet, historique et actions

**Files:**
- Create: `src/pages/FicheObjet.jsx`
- Modify: `src/App.jsx` (route `/o/:code`)

**Interfaces:**
- Consumes : `getObjetParCode`, `modifierObjet`, `supprimerObjet`, `listerHistorique`, `ajouterEntreeHistorique`, `useEmplacements`, `urlsPhotos`, `libelleEvenement`, `normaliserCode`, `formaterCode`, `ETATS`, `peutEcrire`, `estAdmin`, `useOrg().choisir`, `messageErreur`.
- Produces : écran `/o/:code`. Comportement : objet d'une autre organisation de l'utilisateur → bascule automatique de l'organisation active ; code inconnu ou hors accès → message « introuvable ».

- [ ] **Step 1 : Écrire la page**

`src/pages/FicheObjet.jsx` :
```jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import {
  getObjetParCode, modifierObjet, supprimerObjet, listerHistorique, ajouterEntreeHistorique, urlsPhotos,
} from '../data/objets.js';
import { useEmplacements } from '../data/hooks.js';
import { libelleEvenement } from '../domain/historique.js';
import { normaliserCode, formaterCode } from '../domain/codes.js';
import { ETATS } from '../domain/etats.js';
import { peutEcrire, estAdmin } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import EtatBadge from '../components/EtatBadge.jsx';
import ChampGuide from '../components/ChampGuide.jsx';

export default function FicheObjet() {
  const { code: codeUrl } = useParams();
  const code = normaliserCode(codeUrl);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { memberships, orgId, choisir } = useOrg();

  const objetQ = useQuery({ queryKey: ['objet', code], enabled: !!code, queryFn: () => getObjetParCode(code) });
  const objet = objetQ.data;
  const role = memberships.find((m) => m.orgId === objet?.org_id)?.role ?? null;

  // Un QR d'une autre de mes organisations : on bascule dessus.
  useEffect(() => {
    if (objet && objet.org_id !== orgId) choisir(objet.org_id);
  }, [objet, orgId, choisir]);

  const histQ = useQuery({ queryKey: ['historique', objet?.id], enabled: !!objet, queryFn: () => listerHistorique(objet.id) });
  const emps = useEmplacements(objet?.org_id).data ?? [];
  const photoQ = useQuery({
    queryKey: ['photo', objet?.photo_path], enabled: !!objet?.photo_path,
    queryFn: async () => (await urlsPhotos([objet.photo_path]))[objet.photo_path],
  });

  const [emp, setEmp] = useState('');
  const [etat, setEtat] = useState('');
  const [correction, setCorrection] = useState('');
  const [erreur, setErreur] = useState('');

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ['objet', code] });
    qc.invalidateQueries({ queryKey: ['historique', objet?.id] });
    qc.invalidateQueries({ queryKey: ['objets', objet?.org_id] });
  };
  const run = (fn) => async () => {
    setErreur('');
    try { await fn(); rafraichir(); } catch (e) { setErreur(messageErreur(e)); }
  };

  if (!code) {
    return <div className="plai-card"><h1>Code invalide</h1><p>Ce code n'est pas une étiquette Logistécole.</p><Link to="/scan" className="plai-btn btn-lien">Scanner une autre étiquette</Link></div>;
  }
  if (objetQ.isLoading) return <p className="chargement">Chargement…</p>;
  if (objetQ.error) return <p className="plai-error" role="alert">{messageErreur(objetQ.error)}</p>;
  if (!objet) {
    return (
      <div className="plai-card">
        <h1>Objet introuvable</h1>
        <p>Aucun objet ne porte le code <span className="code-court">{formaterCode(code)}</span> dans vos organisations. Il appartient peut-être à une autre école ou à un autre Pôle, ou il a été supprimé.</p>
        <Link to="/scan" className="plai-btn btn-lien">Scanner une autre étiquette</Link>
      </div>
    );
  }

  const ecrit = peutEcrire(role);

  return (
    <>
      <p><Link to="/">← Retour au matériel</Link></p>
      <h1>{objet.nom}</h1>
      <p><EtatBadge etat={objet.etat} /> <span className="code-court">{formaterCode(objet.code)}</span></p>
      {photoQ.data && <img className="fiche-photo" src={photoQ.data} alt={`Photo : ${objet.nom}`} />}

      <section className="plai-card">
        <p><strong>Catégorie :</strong> {objet.logi_categories?.nom ?? 'Aucune'}</p>
        <p><strong>Emplacement :</strong> {objet.logi_emplacements?.nom ?? 'Aucun'}</p>
        {objet.notes && <p><strong>Notes :</strong> {objet.notes}</p>}
      </section>

      {erreur && <p className="plai-error" role="alert">{erreur}</p>}

      {ecrit && (
        <section>
          <h2>Actions</h2>
          <div className="actions">
            <Link className="plai-btn btn-lien" to={`/o/${objet.code}/modifier`}>Modifier la fiche</Link>
            <Link className="plai-btn-ghost btn-lien" to={`/etiquettes?codes=${objet.code}`}>Imprimer l'étiquette</Link>
          </div>

          <ChampGuide id="deplacer" label="Déplacer vers" aide="Enregistre le nouvel emplacement et le garde dans l'historique. Les emplacements se créent dans l'administration.">
            <div className="bloc-action">
              <select id="deplacer" aria-describedby="deplacer-aide" className="plai-input" value={emp} onChange={(e) => setEmp(e.target.value)}>
                <option value="">Choisir un emplacement…</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
              <button className="plai-btn" disabled={!emp || emp === objet.emplacement_id} onClick={run(() => modifierObjet(objet.id, { emplacement_id: emp }))}>Déplacer</button>
            </div>
          </ChampGuide>

          <ChampGuide id="changer-etat" label="Changer l'état" aide="« Sorti de l'inventaire » garde l'objet et son historique (don, rebut) : il disparaît seulement de la liste par défaut.">
            <div className="bloc-action">
              <select id="changer-etat" aria-describedby="changer-etat-aide" className="plai-input" value={etat} onChange={(e) => setEtat(e.target.value)}>
                <option value="">Choisir un état…</option>
                {ETATS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <button className="plai-btn" disabled={!etat || etat === objet.etat} onClick={run(() => modifierObjet(objet.id, { etat }))}>Enregistrer l'état</button>
            </div>
          </ChampGuide>

          <ChampGuide id="correction" label="Ajouter une correction ou une note" aide="L'historique ne se modifie jamais : pour rectifier une erreur ou ajouter un constat, écrivez-le ici. Il s'ajoute à la suite, signé de votre adresse.">
            <div className="bloc-action">
              <input id="correction" aria-describedby="correction-aide" className="plai-input" maxLength={1000}
                placeholder="Ex. : le déplacement du 12 sept. concernait la salle 21, pas la 12"
                value={correction} onChange={(e) => setCorrection(e.target.value)} />
              <button className="plai-btn" disabled={!correction.trim()}
                onClick={run(async () => { await ajouterEntreeHistorique({ objetId: objet.id, orgId: objet.org_id, type: 'correction', commentaire: correction.trim() }); setCorrection(''); })}>
                Ajouter à l'historique
              </button>
            </div>
          </ChampGuide>
        </section>
      )}

      <section>
        <h2>Historique</h2>
        {histQ.error && <p className="plai-error" role="alert">{messageErreur(histQ.error)}</p>}
        <ul className="historique">
          {(histQ.data ?? []).map((ev) => (
            <li key={ev.id}>
              {libelleEvenement(ev)}
              <time dateTime={ev.quand}>{new Date(ev.quand).toLocaleString('fr-BE', { dateStyle: 'long', timeStyle: 'short' })}</time>
              {ev.auteur_email && <span className="auteur">par {ev.auteur_email}</span>}
            </li>
          ))}
        </ul>
      </section>

      {estAdmin(role) && (
        <section>
          <h2>Zone sensible</h2>
          <p className="champ-aide">Supprimer définitivement efface l'objet ET son historique. Pour un don ou un rebut, utilisez plutôt l'état « Sorti de l'inventaire ».</p>
          <button className="btn-danger" onClick={run(async () => {
            if (!window.confirm(`Supprimer définitivement « ${objet.nom} » et tout son historique ?`)) return;
            await supprimerObjet(objet.id);
            qc.invalidateQueries({ queryKey: ['objets', objet.org_id] });
            navigate('/');
          })}>Supprimer définitivement</button>
        </section>
      )}
    </>
  );
}
```

`src/App.jsx` : route `/o/:code` → `<FicheObjet />` (import).

- [ ] **Step 2 : Build**

Run : `npx vite build`
Expected : OK.

- [ ] **Step 3 : Vérifier en navigateur, valeurs et gestes réels**

Dépend de la Tâche 8 pour créer un objet ; si l'objet n'existe pas encore, créer une ligne de test via SQL (avec l'accord de JF, org de test seulement) :
```sql
insert into logi_objets (org_id, nom, code) values ('<ORG_ID>', 'Valise de 16 tablettes', 'TEST2222');
```
Dans le navigateur (`/o/TEST2222`) : lire le titre, le code `TEST-2222`, l'historique contient « Création de l'objet « Valise de 16 tablettes » » ; changer l'état en « Défectueux » puis relire la page : badge « Défectueux » ET nouvelle ligne « État : Bon état → Défectueux » avec la date et l'e-mail de l'auteur ; ajouter une correction : ligne « Correction : … » ; ouvrir `/o/ZZZZ9999` : message « Objet introuvable » (revue focus 1) ; ouvrir `/o/abc` : « Code invalide ». Aucune erreur console.

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "feat: fiche objet, historique, déplacement, état, corrections" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Création (unitaire et en lot) et modification

**Files:**
- Create: `src/pages/FormulaireObjet.jsx`
- Modify: `src/App.jsx` (routes `/nouveau`, `/o/:code/modifier`)

**Interfaces:**
- Consumes : `validerLot`, `genererCodes`, `creerObjets`, `modifierObjet`, `getObjetParCode`, `uploaderPhoto`, `supprimerPhoto`, `validerFichierPhoto`, `compresserImage`, `useCategories`, `useEmplacements`, `ChampGuide`, `peutEcrire`, `messageErreur`.
- Produces : `<FormulaireObjet mode="creer" | "modifier" />`. Après création : 1 objet → `/o/<code>` ; plusieurs → `/etiquettes?codes=<c1>,<c2>,…`.

- [ ] **Step 1 : Écrire le formulaire**

`src/pages/FormulaireObjet.jsx` :
```jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import { creerObjets, modifierObjet, getObjetParCode, uploaderPhoto, supprimerPhoto } from '../data/objets.js';
import { useCategories, useEmplacements } from '../data/hooks.js';
import { validerLot } from '../domain/lot.js';
import { genererCodes, normaliserCode } from '../domain/codes.js';
import { validerFichierPhoto, compresserImage } from '../domain/image.js';
import { ETATS } from '../domain/etats.js';
import { peutEcrire } from '../domain/permissions.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

const VIDE = { nom: '', categorie_id: '', emplacement_id: '', etat: 'bon', notes: '', quantite: '1' };

export default function FormulaireObjet({ mode }) {
  const modif = mode === 'modifier';
  const { code: codeUrl } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { orgId, role } = useOrg();
  const cats = useCategories(orgId).data ?? [];
  const emps = useEmplacements(orgId).data ?? [];

  const existantQ = useQuery({
    queryKey: ['objet', normaliserCode(codeUrl)], enabled: modif && !!normaliserCode(codeUrl),
    queryFn: () => getObjetParCode(normaliserCode(codeUrl)),
  });
  const [f, setF] = useState(VIDE);
  const [fichier, setFichier] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    const o = existantQ.data;
    if (modif && o) setF({ ...VIDE, nom: o.nom, categorie_id: o.categorie_id ?? '', emplacement_id: o.emplacement_id ?? '', etat: o.etat, notes: o.notes ?? '' });
  }, [modif, existantQ.data]);

  if (!peutEcrire(role)) return <p className="plai-error" role="alert">Votre rôle ne permet pas d'ajouter ou de modifier du matériel.</p>;
  if (modif && existantQ.isLoading) return <p className="chargement">Chargement…</p>;
  if (modif && !existantQ.data) return <p className="plai-error" role="alert">Objet introuvable.</p>;
  if (cats.length === 0) {
    return (
      <div className="plai-card">
        <h1>Aucune catégorie</h1>
        <p>Une catégorie est nécessaire pour classer le matériel. Un administrateur peut en ajouter dans l'<Link to="/admin">administration</Link>.</p>
      </div>
    );
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');
    if (!f.categorie_id) { setErreur('Choisissez une catégorie.'); return; }
    const lot = modif ? validerLot({ nom: f.nom, quantite: 1 }) : validerLot({ nom: f.nom, quantite: f.quantite });
    if (!lot.ok) { setErreur(lot.erreur); return; }
    if (fichier) {
      const v = validerFichierPhoto(fichier);
      if (!v.ok) { setErreur(v.erreur); return; }
    }

    setEnvoi(true);
    let photoPath = null;
    try {
      if (fichier) photoPath = await uploaderPhoto(orgId, await compresserImage(fichier));
      const commun = {
        nom: lot.nom,
        categorie_id: f.categorie_id,
        emplacement_id: f.emplacement_id || null,
        notes: f.notes.trim() || null,
      };

      if (modif) {
        const champs = { ...commun };
        if (photoPath) champs.photo_path = photoPath;
        await modifierObjet(existantQ.data.id, champs);
        qc.invalidateQueries({ queryKey: ['objet'] });
        qc.invalidateQueries({ queryKey: ['objets', orgId] });
        navigate(`/o/${existantQ.data.code}`);
        return;
      }

      // Collision de code improbable : jusqu'à 3 tentatives avec de nouveaux codes.
      let crees;
      for (let essai = 0; ; essai++) {
        const codes = genererCodes(lot.quantite);
        try {
          crees = await creerObjets(orgId, codes.map((code) => ({ ...commun, etat: f.etat, photo_path: photoPath, code })));
          break;
        } catch (err) {
          if (err?.code !== '23505' || essai >= 2) throw err;
        }
      }
      qc.invalidateQueries({ queryKey: ['objets', orgId] });
      const codes = crees.map((c) => c.objet_code);
      navigate(codes.length === 1 ? `/o/${codes[0]}` : `/etiquettes?codes=${codes.join(',')}`);
    } catch (err) {
      if (photoPath) await supprimerPhoto(photoPath);
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} noValidate>
      <h1>{modif ? 'Modifier la fiche' : 'Ajouter du matériel'}</h1>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}

      <ChampGuide id="nom" label="Nom de l'objet" obligatoire aide="Apparaît dans la liste et sur l'étiquette imprimée. Soyez précis pour le retrouver : 120 caractères au maximum.">
        <input id="nom" aria-describedby="nom-aide" className="plai-input" maxLength={120} placeholder="Ex. : Valise de 16 tablettes, salle 12" value={f.nom} onChange={maj('nom')} />
      </ChampGuide>

      <ChampGuide id="categorie" label="Catégorie" obligatoire aide="Sert à filtrer la liste. Les catégories sont gérées par l'administrateur de votre organisation.">
        <select id="categorie" aria-describedby="categorie-aide" className="plai-input" value={f.categorie_id} onChange={maj('categorie_id')}>
          <option value="">Choisir une catégorie…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </ChampGuide>

      <ChampGuide id="emplacement" label="Emplacement" aide="Où l'objet est rangé (facultatif). Vous pourrez le déplacer plus tard : chaque déplacement est gardé dans l'historique.">
        <select id="emplacement" aria-describedby="emplacement-aide" className="plai-input" value={f.emplacement_id} onChange={maj('emplacement_id')}>
          <option value="">Aucun emplacement</option>
          {emps.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      </ChampGuide>

      {!modif && (
        <>
          <ChampGuide id="etat" label="État à l'arrivée" aide="L'état de l'objet au moment où vous l'enregistrez. Il pourra changer ensuite et chaque changement est tracé.">
            <select id="etat" aria-describedby="etat-aide" className="plai-input" value={f.etat} onChange={maj('etat')}>
              {ETATS.filter((e) => e.value !== 'sorti').map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </ChampGuide>

          <ChampGuide id="quantite" label="Nombre d'exemplaires identiques" obligatoire aide="Pour 16 tablettes identiques, tapez 16 : chacune reçoit son propre code et sa propre étiquette. Entre 1 et 100 à la fois.">
            <input id="quantite" aria-describedby="quantite-aide" className="plai-input" inputMode="numeric" placeholder="Ex. : 16" value={f.quantite} onChange={maj('quantite')} />
          </ChampGuide>
        </>
      )}

      <ChampGuide id="photo" label="Photo" aide="Facultative. Elle est réduite automatiquement (environ 200 Ko) avant l'envoi. Avec plusieurs exemplaires, la même photo sert pour tous.">
        <input id="photo" aria-describedby="photo-aide" className="plai-input" type="file" accept="image/*" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
      </ChampGuide>

      <ChampGuide id="notes" label="Notes" aide="Tout ce qui aide à s'en servir ou à le retrouver : numéro de série, mot de passe du chariot, accessoires fournis. Pas de nom d'élève.">
        <textarea id="notes" aria-describedby="notes-aide" className="plai-input" rows={3} maxLength={2000} placeholder="Ex. : chargeurs dans le tiroir du bas, clé chez la secrétaire" value={f.notes} onChange={maj('notes')} />
      </ChampGuide>

      <div className="actions">
        <button className="plai-btn" disabled={envoi}>{envoi ? 'Enregistrement…' : modif ? 'Enregistrer les modifications' : 'Ajouter'}</button>
        <Link className="plai-btn-ghost btn-lien" to={modif ? `/o/${normaliserCode(codeUrl)}` : '/'}>Annuler</Link>
      </div>
    </form>
  );
}
```

`src/App.jsx` : routes `/nouveau` → `<FormulaireObjet mode="creer" />`, `/o/:code/modifier` → `<FormulaireObjet mode="modifier" />`.

- [ ] **Step 2 : Build**

Run : `npx vite build`
Expected : OK.

- [ ] **Step 3 : Vérifier en navigateur (gestes réels, valeurs lues)**

Sur `/nouveau` : (a) valider vide → message « Le nom est obligatoire. » et aucune requête réseau (`read_network_requests`) ; (b) quantité `101` → message « entre 1 et 100 », aucune requête ; (c) quantité `2.5` → refus ; (d) choisir un PDF dans le champ photo → message « doit être une image » ; (e) créer « Tablette de test » ×3 avec une vraie photo : redirection vers `/etiquettes?codes=…` avec 3 codes ; retour sur `/` : 3 lignes distinctes avec 3 codes différents, la photo en vignette ; ouvrir une fiche : historique « Création de l'objet » ; (f) modifier le nom : l'historique gagne « Modification de « nom » : « Tablette de test » → « … » ». Lire en base (avec accord JF) ou dans l'historique affiché que les valeurs avant/après sont exactes. Taille de la photo envoyée ≤ ~200 Ko (`read_network_requests` sur l'upload, content-length).

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "feat: création unitaire et en lot, modification, photo compressée" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Scan par la caméra

**Files:**
- Create: `src/pages/Scan.jsx`
- Modify: `src/App.jsx` (route `/scan` en `React.lazy`)

**Interfaces:**
- Consumes : `extraireCodeDepuisTexte`, `normaliserCode`, `QrScanner` (`qr-scanner`).
- Produces : écran `/scan` : caméra arrière, détection d'un QR ; code valide → navigation `/o/<code>` ; QR étranger → message et le scan continue ; caméra refusée → saisie manuelle.

- [ ] **Step 1 : Écrire la page**

`src/pages/Scan.jsx` :
```jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { extraireCodeDepuisTexte } from '../domain/codes.js';
import ChampGuide from '../components/ChampGuide.jsx';

export default function Scan() {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const [message, setMessage] = useState('Pointez la caméra vers le QR code de l\'étiquette.');
  const [alerte, setAlerte] = useState(false);
  const [camera, setCamera] = useState('demarrage'); // demarrage | ok | indisponible
  const [saisie, setSaisie] = useState('');

  useEffect(() => {
    let dernier = '';
    let dernierTemps = 0;
    const scanner = new QrScanner(
      videoRef.current,
      (res) => {
        const texte = res.data;
        const maintenant = Date.now();
        if (texte === dernier && maintenant - dernierTemps < 2000) return; // évite le clignotement du message
        dernier = texte;
        dernierTemps = maintenant;
        const code = extraireCodeDepuisTexte(texte);
        if (code) {
          scanner.stop();
          navigate(`/o/${code}`);
        } else {
          setAlerte(true);
          setMessage('Ce QR code n\'est pas une étiquette Logistécole. Essayez une autre étiquette ou saisissez le code ci-dessous.');
        }
      },
      { preferredCamera: 'environment', highlightScanRegion: true, returnDetailedScanResult: true },
    );
    scanner.start().then(() => setCamera('ok')).catch(() => setCamera('indisponible'));
    return () => scanner.destroy();
  }, [navigate]);

  function ouvrir(e) {
    e.preventDefault();
    const code = extraireCodeDepuisTexte(saisie);
    if (!code) {
      setAlerte(true);
      setMessage('Ce code n\'est pas valide. Il compte 8 caractères (lettres et chiffres), par exemple ABCD-2345.');
      return;
    }
    navigate(`/o/${code}`);
  }

  return (
    <>
      <h1>Scanner une étiquette</h1>
      {camera === 'indisponible' ? (
        <p className="plai-error" role="alert">La caméra est indisponible ou refusée. Autorisez-la dans votre navigateur, ou saisissez le code inscrit sur l'étiquette.</p>
      ) : (
        <>
          <video ref={videoRef} className="scan-video" muted playsInline />
          <p className={alerte ? 'plai-error' : 'accroche'} role="status">{message}</p>
        </>
      )}
      {camera === 'indisponible' && <video ref={videoRef} hidden />}
      <form className="plai-card scan-manuel" onSubmit={ouvrir}>
        <ChampGuide id="code" label="Ou saisissez le code de l'étiquette" aide="Le code est imprimé sous le QR, sous la forme ABCD-2345. Majuscules ou minuscules, avec ou sans tiret.">
          <input id="code" aria-describedby="code-aide" className="plai-input" placeholder="Ex. : ABCD-2345" autoCapitalize="characters" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </ChampGuide>
        <button className="plai-btn">Ouvrir la fiche</button>
      </form>
    </>
  );
}
```

`src/App.jsx` : charger paresseusement.
```jsx
import { lazy, Suspense } from 'react';
const Scan = lazy(() => import('./pages/Scan.jsx'));
// … dans les routes :
<Route path="/scan" element={<Suspense fallback={<p className="chargement">Chargement…</p>}><Scan /></Suspense>} />
```

- [ ] **Step 2 : Build**

Run : `npx vite build`
Expected : OK ; le bundle de `Scan` est séparé.

- [ ] **Step 3 : Vérifier (saisie manuelle dans le navigateur ; caméra sur téléphone en recette)**

Dans le navigateur : saisir `abcd 2345` d'un objet existant → ouvre la fiche ; saisir `ABC` → message d'erreur sans navigation ; saisir `https://exemple.be/x` → même message. Sans caméra disponible (poste sans webcam, ou refus), la page affiche l'erreur caméra et le champ manuel fonctionne. Le test avec un vrai QR et la caméra d'un téléphone est dans la recette (Tâche 13).

- [ ] **Step 4 : Commit**

```bash
git add -A && git commit -m "feat: scan caméra et saisie manuelle du code" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Étiquettes PDF avec QR

**Files:**
- Create: `src/domain/etiquettes.js`, `src/pages/Etiquettes.jsx`
- Test: `tests/domain/etiquettes.test.js`, `tests/domain/qr-roundtrip.test.js`
- Modify: `src/App.jsx` (route `/etiquettes` en `React.lazy`)

**Interfaces:**
- Consumes : `formaterCode`, `extraireCodeDepuisTexte`, `useObjets`, `filtrerObjets`, `useOrg`.
- Produces :
  - `etiquettes.js` : `calculerPlanche(options?): {x,y,w,h}[]` (24 cellules par défaut : 3 colonnes × 8 lignes A4), `tronquerTexte(texte, max): string`, `nettoyerPourPdf(texte): string`, `genererPdfEtiquettes(objets, orgNom, baseUrl): Promise<jsPDF>`.
  - Écran `/etiquettes` avec sélection (préselection par `?codes=A,B`).

- [ ] **Step 1 : Écrire les tests qui échouent**

`tests/domain/etiquettes.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { calculerPlanche, tronquerTexte, nettoyerPourPdf } from '../../src/domain/etiquettes.js';

describe('calculerPlanche', () => {
  it('donne 24 cellules qui tiennent dans la page A4 sans se chevaucher', () => {
    const c = calculerPlanche();
    expect(c).toHaveLength(24);
    for (const { x, y, w, h } of c) {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(y).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(x + w).toBeLessThanOrEqual(200 + 1e-9);
      expect(y + h).toBeLessThanOrEqual(287 + 1e-9);
    }
    expect(c[1].x).toBeCloseTo(c[0].x + c[0].w);
    expect(c[3].y).toBeCloseTo(c[0].y + c[0].h);
  });
});

describe('tronquerTexte / nettoyerPourPdf (revue focus 5)', () => {
  it('tronque un nom très long avec des points de suspension ASCII', () => {
    const t = tronquerTexte('x'.repeat(500), 48);
    expect(t.length).toBeLessThanOrEqual(48);
    expect(t.endsWith('...')).toBe(true);
  });
  it('laisse intact un nom court et normalise les espaces', () => {
    expect(tronquerTexte('  Valise   de tablettes ', 48)).toBe('Valise de tablettes');
  });
  it('conserve les accents français et remplace ce que la police ne sait pas dessiner', () => {
    expect(nettoyerPourPdf('Matériel d\'éveil à l\'écoute')).toBe('Matériel d\'éveil à l\'écoute');
    expect(nettoyerPourPdf('Projecteur 📽 salle 12')).toBe('Projecteur ? salle 12');
    expect(nettoyerPourPdf('Cœur')).toBe('C?ur');
  });
  it('supporte une valeur absente', () => {
    expect(tronquerTexte(undefined, 10)).toBe('');
  });
});
```
Note : `œ` (U+0153) est hors Latin-1 et ressort donc en `?` ; c'est le comportement attendu de `nettoyerPourPdf` (limite de la police PDF standard). Le noter dans l'aide de la page Étiquettes.

`tests/domain/qr-roundtrip.test.js` :
```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { extraireCodeDepuisTexte } from '../../src/domain/codes.js';

describe('le QR imprimé contient bien l\'adresse de la fiche', () => {
  it('lit le QR généré et retrouve le code de l\'objet', async () => {
    const url = 'https://logistecole.jfb4plai.com/o/ABCD2345';
    const buf = await QRCode.toBuffer(url, { margin: 1, width: 256, errorCorrectionLevel: 'M' });
    const png = PNG.sync.read(buf);
    const lu = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(lu).not.toBeNull();
    expect(lu.data).toBe(url);
    expect(extraireCodeDepuisTexte(lu.data)).toBe('ABCD2345');
  });
});
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/domain/etiquettes.test.js tests/domain/qr-roundtrip.test.js`
Expected : `etiquettes.test.js` FAIL (module introuvable) ; `qr-roundtrip` peut déjà passer (il ne dépend que de `codes.js`), c'est normal.

- [ ] **Step 3 : Implémenter**

`src/domain/etiquettes.js` :
```js
import { formaterCode } from './codes.js';

export function calculerPlanche({ colonnes = 3, lignes = 8, largeur = 210, hauteur = 297, marge = 10 } = {}) {
  const w = (largeur - 2 * marge) / colonnes;
  const h = (hauteur - 2 * marge) / lignes;
  const cellules = [];
  for (let l = 0; l < lignes; l++) {
    for (let c = 0; c < colonnes; c++) cellules.push({ x: marge + c * w, y: marge + l * h, w, h });
  }
  return cellules;
}

export function tronquerTexte(texte, max) {
  const s = String(texte ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 3).trimEnd()}...`;
}

// Les polices PDF standard ne dessinent que le Latin-1 : le reste devient « ? ».
export function nettoyerPourPdf(texte) {
  return Array.from(String(texte ?? ''), (ch) => {
    const n = ch.codePointAt(0);
    return n >= 32 && n <= 255 && !(n >= 127 && n <= 159) ? ch : '?';
  }).join('');
}

export async function genererPdfEtiquettes(objets, orgNom, baseUrl) {
  const [{ jsPDF }, qrModule] = await Promise.all([import('jspdf'), import('qrcode')]);
  const QRCode = qrModule.default ?? qrModule;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cellules = calculerPlanche();

  for (let i = 0; i < objets.length; i++) {
    if (i > 0 && i % cellules.length === 0) doc.addPage();
    const { x, y, w, h } = cellules[i % cellules.length];
    const o = objets[i];

    doc.setDrawColor(200);
    doc.rect(x, y, w, h);

    const qr = await QRCode.toDataURL(`${baseUrl}/o/${o.code}`, { margin: 1, width: 256, errorCorrectionLevel: 'M' });
    const taille = 26;
    doc.addImage(qr, 'PNG', x + 2, y + (h - taille) / 2, taille, taille);

    const tx = x + taille + 5;
    const largeurTexte = w - taille - 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(nettoyerPourPdf(tronquerTexte(o.nom, 48)), largeurTexte).slice(0, 3), tx, y + 8);

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(formaterCode(o.code), tx, y + h - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(doc.splitTextToSize(nettoyerPourPdf(tronquerTexte(orgNom, 40)), largeurTexte).slice(0, 2), tx, y + h - 6);
  }
  return doc;
}
```

`src/pages/Etiquettes.jsx` :
```jsx
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrg } from '../lib/org.jsx';
import { useObjets } from '../data/hooks.js';
import { filtrerObjets } from '../domain/filtres.js';
import { formaterCode } from '../domain/codes.js';
import { messageErreur } from '../lib/erreurs.js';
import { genererPdfEtiquettes } from '../domain/etiquettes.js';
import ChampGuide from '../components/ChampGuide.jsx';

export default function Etiquettes() {
  const { orgId, orgNom } = useOrg();
  const [params] = useSearchParams();
  const objetsQ = useObjets(orgId);
  const [q, setQ] = useState('');
  const [choix, setChoix] = useState(new Set());
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const demandes = useMemo(() => (params.get('codes') ?? '').split(',').filter(Boolean), [params]);
  useEffect(() => {
    if (objetsQ.data && demandes.length) {
      setChoix(new Set(objetsQ.data.filter((o) => demandes.includes(o.code)).map((o) => o.id)));
    }
  }, [objetsQ.data, demandes]);

  const visibles = filtrerObjets(objetsQ.data ?? [], { q });
  const basculer = (id) => setChoix((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function generer() {
    setErreur('');
    setEnvoi(true);
    try {
      const objets = (objetsQ.data ?? []).filter((o) => choix.has(o.id));
      const doc = await genererPdfEtiquettes(objets, orgNom, window.location.origin);
      doc.save('etiquettes-logistecole.pdf');
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <h1>Étiquettes à imprimer</h1>
      <p className="accroche">Une planche A4 contient 24 étiquettes. Imprimez sur papier autocollant ou sur papier ordinaire, à 100 % (sans « ajuster à la page »).</p>
      <ChampGuide id="q" label="Rechercher dans le matériel" aide="Filtre la liste ci-dessous. Votre sélection est conservée quand vous cherchez autre chose.">
        <input id="q" aria-describedby="q-aide" type="search" className="plai-input" placeholder="Ex. : tablette" value={q} onChange={(e) => setQ(e.target.value)} />
      </ChampGuide>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="plai-btn" disabled={choix.size === 0 || envoi} onClick={generer}>
          {envoi ? 'Création du PDF…' : `Générer le PDF (${choix.size} étiquette${choix.size > 1 ? 's' : ''})`}
        </button>
        <button className="plai-btn-ghost" onClick={() => setChoix(new Set(visibles.map((o) => o.id)))}>Tout sélectionner ({visibles.length})</button>
        <button className="plai-btn-ghost" onClick={() => setChoix(new Set())}>Tout désélectionner</button>
      </div>
      <p className="champ-aide">Les caractères que la police du PDF ne sait pas dessiner (emoji, « œ ») apparaissent sous la forme « ? » sur l'étiquette. Les noms trop longs sont raccourcis.</p>
      {objetsQ.isLoading && <p className="chargement">Chargement…</p>}
      <ul className="liste-cases">
        {visibles.map((o) => (
          <li key={o.id}>
            <label>
              <input type="checkbox" checked={choix.has(o.id)} onChange={() => basculer(o.id)} />
              <span>{o.nom} <span className="code-court">{formaterCode(o.code)}</span></span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
```

`src/App.jsx` : route `/etiquettes` en lazy comme pour `Scan`.

- [ ] **Step 4 : Tests et build**

Run : `npx vitest run && npx vite build`
Expected : tous les tests PASS (dont `qr-roundtrip`), build OK.

- [ ] **Step 5 : Vérifier le PDF réel**

Dans le navigateur, sur `/etiquettes?codes=…` (objets de la Tâche 8) : la sélection est pré-cochée (lire le libellé du bouton « Générer le PDF (3 étiquettes) »). Cliquer : un fichier `etiquettes-logistecole.pdf` est téléchargé. L'ouvrir (`pdf_to_image` du connecteur Adobe ou outil PDF de la session) et vérifier visuellement : QR net, nom tronqué sans débordement, code `ABCD-2345` lisible, nom de l'organisation en petit. Créer un objet de test au nom de 200 caractères avec un emoji pour confirmer la troncature et le « ? ».

- [ ] **Step 6 : Commit**

```bash
git add -A && git commit -m "feat: étiquettes PDF avec QR, planche A4 de 24" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : Administration — emplacements, catégories, membres, invitation

**Files:**
- Create: `src/pages/Admin.jsx`, `src/pages/AdminReferentiel.jsx`, `src/pages/AdminMembres.jsx`, `src/data/membres.js`, `api/inviter.js`
- Test: `tests/api/inviter.test.js`
- Modify: `src/App.jsx` (route `/admin` en lazy)

**Interfaces:**
- Consumes : `listerReferentiel`, `ajouterReferentiel`, `renommerReferentiel`, `supprimerReferentiel`, `useCategories`, `useEmplacements`, `estAdmin`, `supabase` (token de session pour l'API).
- Produces :
  - `data/membres.js` : `listerMembres(orgId)`, `changerRole(userId, orgId, role)`, `retirerMembre(userId, orgId)`, `inviterMembre({ orgId, email, role }): Promise<{ ok: true, invite: boolean }>` (POST `/api/inviter` avec `Authorization: Bearer <access_token>`).
  - `api/inviter.js` : `creerHandler({ creerClient?, env? })` et `export default creerHandler()`. Réponses : 405, 401, 400, 403 (non admin de l'organisation), 429 (≥ 20 membres ajoutés en 24 h pour cette organisation), 200 `{ ok: true, invite }`.
  - Variables d'environnement serveur : `SUPABASE_URL` (ou `VITE_SUPABASE_URL`), `SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`.

- [ ] **Step 1 : Écrire le test de l'API (échoue)**

`tests/api/inviter.test.js` :
```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { creerHandler } from '../../api/inviter.js';

const ENV = { SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', SITE_URL: 'https://logistecole.jfb4plai.com' };

function faux({ user = { id: 'u1' }, roleAppelant = 'admin', recents = 0, idExistant = null } = {}) {
  const appels = { invite: [], upsert: [] };
  const admin = {
    rpc: async () => ({ data: idExistant, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ gte: async () => ({ count: recents, error: null }) }) }),
      upsert: async (ligne) => { appels.upsert.push(ligne); return { error: null }; },
    }),
    auth: { admin: { inviteUserByEmail: async (email, opts) => { appels.invite.push([email, opts]); return { data: { user: { id: 'nouveau' } }, error: null }; } } },
  };
  const appelant = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: roleAppelant ? { role: roleAppelant } : null, error: null }) }) }) }) }),
  };
  return { creerClient: (_url, cle) => (cle === 'service' ? admin : appelant), appels };
}

function reponse() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const requete = (over = {}) => ({
  method: 'POST',
  headers: { authorization: 'Bearer jeton' },
  body: { orgId: 'o1', email: 'Prof@Ecole-Liege.be ', role: 'gestionnaire' },
  ...over,
});

describe('/api/inviter', () => {
  it('refuse une méthode autre que POST', async () => {
    const res = reponse();
    await creerHandler({ creerClient: faux().creerClient, env: ENV })(requete({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });
  it('refuse sans jeton', async () => {
    const res = reponse();
    await creerHandler({ creerClient: faux().creerClient, env: ENV })(requete({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
  });
  it('refuse une adresse, un rôle ou une organisation invalide', async () => {
    for (const body of [{ orgId: 'o1', email: 'pas-un-mail', role: 'admin' }, { orgId: 'o1', email: 'a@b.be', role: 'roi' }, { email: 'a@b.be', role: 'admin' }]) {
      const res = reponse();
      await creerHandler({ creerClient: faux().creerClient, env: ENV })(requete({ body }), res);
      expect(res.statusCode).toBe(400);
    }
  });
  it('refuse un appelant qui n\'est pas admin de l\'organisation', async () => {
    for (const roleAppelant of ['gestionnaire', 'lecture', null]) {
      const res = reponse();
      await creerHandler({ creerClient: faux({ roleAppelant }).creerClient, env: ENV })(requete(), res);
      expect(res.statusCode).toBe(403);
    }
  });
  it('limite le nombre d\'ajouts par jour', async () => {
    const res = reponse();
    await creerHandler({ creerClient: faux({ recents: 20 }).creerClient, env: ENV })(requete(), res);
    expect(res.statusCode).toBe(429);
  });
  it('invite un nouvel utilisateur avec une redirection et crée le membre', async () => {
    const f = faux();
    const res = reponse();
    await creerHandler({ creerClient: f.creerClient, env: ENV })(requete(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, invite: true });
    expect(f.appels.invite[0][0]).toBe('prof@ecole-liege.be');
    expect(f.appels.invite[0][1].redirectTo).toBe('https://logistecole.jfb4plai.com');
    expect(f.appels.upsert[0]).toMatchObject({ user_id: 'nouveau', org_id: 'o1', role: 'gestionnaire', email: 'prof@ecole-liege.be' });
  });
  it('rattache un utilisateur déjà inscrit sans renvoyer d\'invitation', async () => {
    const f = faux({ idExistant: 'deja-la' });
    const res = reponse();
    await creerHandler({ creerClient: f.creerClient, env: ENV })(requete(), res);
    expect(res.body).toEqual({ ok: true, invite: false });
    expect(f.appels.invite).toHaveLength(0);
    expect(f.appels.upsert[0].user_id).toBe('deja-la');
  });
});
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/api`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : Implémenter l'API**

`api/inviter.js` :
```js
import { createClient } from '@supabase/supabase-js';

const ROLES = ['admin', 'gestionnaire', 'lecture'];
const PLAFOND_PAR_JOUR = 20;

export function creerHandler({ creerClient = createClient, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });

    const jeton = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!jeton) return res.status(401).json({ erreur: 'Connexion requise' });

    const { orgId, email, role } = req.body || {};
    const adresse = String(email || '').trim().toLowerCase();
    if (!orgId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse) || !ROLES.includes(role)) {
      return res.status(400).json({ erreur: 'Adresse, rôle ou organisation invalide' });
    }

    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    const service = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) return res.status(500).json({ erreur: 'Configuration serveur incomplète' });

    // 1. Qui appelle, et est-ce un admin de cette organisation ? (RLS appliquée avec son jeton)
    const appelant = creerClient(url, anon, { global: { headers: { Authorization: `Bearer ${jeton}` } } });
    const { data: u, error: errUser } = await appelant.auth.getUser(jeton);
    if (errUser || !u?.user) return res.status(401).json({ erreur: 'Session invalide' });
    const { data: moi } = await appelant
      .from('logi_membres').select('role').eq('org_id', orgId).eq('user_id', u.user.id).maybeSingle();
    if (moi?.role !== 'admin') return res.status(403).json({ erreur: 'Réservé aux administrateurs de cette organisation' });

    // 2. Le reste avec la clé service, côté serveur uniquement.
    const admin = creerClient(url, service);
    const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from('logi_membres').select('user_id', { count: 'exact', head: true }).eq('org_id', orgId).gte('cree_le', depuis);
    if ((count ?? 0) >= PLAFOND_PAR_JOUR) return res.status(429).json({ erreur: 'Trop d\'ajouts aujourd\'hui, réessayez demain' });

    let userId = (await admin.rpc('logi_id_par_email', { p_email: adresse })).data;
    let invite = false;
    if (!userId) {
      const { data: inv, error: errInv } = await admin.auth.admin.inviteUserByEmail(adresse, { redirectTo: env.SITE_URL });
      if (errInv || !inv?.user) return res.status(502).json({ erreur: 'Envoi de l\'invitation impossible' });
      userId = inv.user.id;
      invite = true;
    }

    const { error: errMembre } = await admin
      .from('logi_membres').upsert({ user_id: userId, org_id: orgId, role, email: adresse }, { onConflict: 'user_id,org_id' });
    if (errMembre) return res.status(500).json({ erreur: 'Enregistrement du membre impossible' });
    return res.status(200).json({ ok: true, invite });
  };
}

export default creerHandler();
```

- [ ] **Step 4 : Lancer, constater le succès**

Run : `npx vitest run tests/api`
Expected : PASS.

- [ ] **Step 5 : Écrire les écrans d'administration**

`src/data/membres.js` :
```js
import { supabase } from '../lib/supabase.js';

function verifier(error) {
  if (error) throw error;
}

export async function listerMembres(orgId) {
  const { data, error } = await supabase.from('logi_membres').select('user_id, email, role, cree_le').eq('org_id', orgId).order('email');
  verifier(error);
  return data;
}

export async function changerRole(userId, orgId, role) {
  const { error } = await supabase.from('logi_membres').update({ role }).eq('user_id', userId).eq('org_id', orgId);
  verifier(error);
}

export async function retirerMembre(userId, orgId) {
  const { error } = await supabase.from('logi_membres').delete().eq('user_id', userId).eq('org_id', orgId);
  verifier(error);
}

export async function inviterMembre({ orgId, email, role }) {
  const { data } = await supabase.auth.getSession();
  const rep = await fetch('/api/inviter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify({ orgId, email, role }),
  });
  const corps = await rep.json().catch(() => ({}));
  if (!rep.ok) throw { status: rep.status, message: corps.erreur ?? '' };
  return corps;
}
```

`src/pages/Admin.jsx` :
```jsx
import { useState } from 'react';
import { useOrg } from '../lib/org.jsx';
import { estAdmin } from '../domain/permissions.js';
import AdminReferentiel from './AdminReferentiel.jsx';
import AdminMembres from './AdminMembres.jsx';

export default function Admin() {
  const { role } = useOrg();
  const [onglet, setOnglet] = useState('emplacements');
  if (!estAdmin(role)) return <p className="plai-error" role="alert">Cette page est réservée aux administrateurs de l'organisation.</p>;
  return (
    <>
      <h1>Administration</h1>
      <div className="onglets-admin" role="tablist">
        {[['emplacements', 'Emplacements'], ['categories', 'Catégories'], ['membres', 'Membres']].map(([id, nom]) => (
          <button key={id} role="tab" aria-selected={onglet === id} className={onglet === id ? 'plai-btn' : 'plai-btn-ghost'} onClick={() => setOnglet(id)}>{nom}</button>
        ))}
      </div>
      {onglet === 'emplacements' && (
        <AdminReferentiel
          table="logi_emplacements" avecParent titre="Emplacements"
          placeholder="Ex. : Armoire A, salle 12"
          aide="Là où le matériel est rangé. Choisissez un emplacement parent pour faire une arborescence (bâtiment > local > armoire). Un emplacement encore utilisé par du matériel ne peut pas être supprimé."
        />
      )}
      {onglet === 'categories' && (
        <AdminReferentiel
          table="logi_categories" titre="Catégories"
          placeholder="Ex. : Matériel de sciences"
          aide="Servent à classer et filtrer le matériel. Une catégorie encore utilisée ne peut pas être supprimée."
        />
      )}
      {onglet === 'membres' && <AdminMembres />}
    </>
  );
}
```

`src/pages/AdminReferentiel.jsx` :
```jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../lib/org.jsx';
import { listerReferentiel, ajouterReferentiel, renommerReferentiel, supprimerReferentiel } from '../data/referentiels.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

export default function AdminReferentiel({ table, titre, placeholder, aide, avecParent = false }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const cle = table === 'logi_emplacements' ? 'emplacements' : 'categories';
  const q = useQuery({ queryKey: [cle, orgId], queryFn: () => listerReferentiel(table, orgId) });
  const [nom, setNom] = useState('');
  const [parent, setParent] = useState('');
  const [erreur, setErreur] = useState('');

  const elements = q.data ?? [];
  const parNom = Object.fromEntries(elements.map((e) => [e.id, e]));
  const chemin = (e) => (e.parent_id && parNom[e.parent_id] ? `${chemin(parNom[e.parent_id])} › ${e.nom}` : e.nom);
  const tries = [...elements].sort((a, b) => chemin(a).localeCompare(chemin(b), 'fr'));

  async function agir(fn) {
    setErreur('');
    try { await fn(); qc.invalidateQueries({ queryKey: [cle, orgId] }); } catch (e) { setErreur(messageErreur(e)); }
  }

  return (
    <section>
      <h2>{titre}</h2>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      <form className="plai-card" onSubmit={(e) => { e.preventDefault(); if (!nom.trim()) return; agir(async () => { await ajouterReferentiel(table, orgId, nom, parent); setNom(''); }); }}>
        <ChampGuide id="nouveau-nom" label="Nouveau nom" aide={aide}>
          <input id="nouveau-nom" aria-describedby="nouveau-nom-aide" className="plai-input" maxLength={120} placeholder={placeholder} value={nom} onChange={(e) => setNom(e.target.value)} />
        </ChampGuide>
        {avecParent && (
          <ChampGuide id="parent" label="Emplacement parent" aide="Facultatif. Laissez vide pour un emplacement de premier niveau.">
            <select id="parent" aria-describedby="parent-aide" className="plai-input" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Aucun (premier niveau)</option>
              {tries.map((e) => <option key={e.id} value={e.id}>{chemin(e)}</option>)}
            </select>
          </ChampGuide>
        )}
        <button className="plai-btn" disabled={!nom.trim()}>Ajouter</button>
      </form>
      {q.isLoading && <p className="chargement">Chargement…</p>}
      <table className="tableau">
        <tbody>
          {tries.map((e) => (
            <tr key={e.id}>
              <td>{chemin(e)}</td>
              <td>
                <button className="plai-btn-ghost" onClick={() => {
                  const n = window.prompt('Nouveau nom :', e.nom);
                  if (n && n.trim() && n.trim() !== e.nom) agir(() => renommerReferentiel(table, e.id, n));
                }}>Renommer</button>{' '}
                <button className="plai-btn-ghost" onClick={() => { if (window.confirm(`Supprimer « ${e.nom} » ?`)) agir(() => supprimerReferentiel(table, e.id)); }}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

`src/pages/AdminMembres.jsx` :
```jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.jsx';
import { useOrg } from '../lib/org.jsx';
import { listerMembres, changerRole, retirerMembre, inviterMembre } from '../data/membres.js';
import { messageErreur } from '../lib/erreurs.js';
import ChampGuide from '../components/ChampGuide.jsx';

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'gestionnaire', label: 'Gestionnaire' },
  { value: 'lecture', label: 'Lecture seule' },
];

export default function AdminMembres() {
  const { orgId } = useOrg();
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['membres', orgId], queryFn: () => listerMembres(orgId) });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('gestionnaire');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  async function agir(fn, succes = '') {
    setErreur(''); setInfo('');
    try { const r = await fn(); qc.invalidateQueries({ queryKey: ['membres', orgId] }); if (succes) setInfo(typeof succes === 'function' ? succes(r) : succes); } catch (e) { setErreur(messageErreur(e)); }
  }

  return (
    <section>
      <h2>Membres</h2>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {info && <p className="plai-success" role="status">{info}</p>}
      <form className="plai-card" onSubmit={(e) => { e.preventDefault(); agir(async () => { const r = await inviterMembre({ orgId, email, role }); setEmail(''); return r; }, (r) => r.invite ? 'Invitation envoyée par e-mail.' : 'Cette personne avait déjà un compte : elle a maintenant accès à votre organisation.'); }}>
        <ChampGuide id="inv-email" label="Adresse e-mail à inviter" obligatoire aide="La personne reçoit un lien de connexion à cette adresse. Utilisez son adresse professionnelle. Limite : 20 ajouts par jour.">
          <input id="inv-email" aria-describedby="inv-email-aide" type="email" required className="plai-input" placeholder="prenom.nom@ecole-liege.be" value={email} onChange={(e) => setEmail(e.target.value)} />
        </ChampGuide>
        <ChampGuide id="inv-role" label="Rôle" aide="Administrateur : tout gérer, y compris les membres. Gestionnaire : ajouter, modifier et déplacer le matériel. Lecture seule : consulter.">
          <select id="inv-role" aria-describedby="inv-role-aide" className="plai-input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </ChampGuide>
        <button className="plai-btn">Inviter</button>
      </form>

      <table className="tableau">
        <thead><tr><th>Adresse</th><th>Rôle</th><th></th></tr></thead>
        <tbody>
          {(q.data ?? []).map((m) => {
            const moi = m.user_id === session?.user?.id;
            return (
              <tr key={m.user_id}>
                <td>{m.email}{moi && ' (vous)'}</td>
                <td>
                  <select aria-label={`Rôle de ${m.email}`} className="plai-input" value={m.role} disabled={moi}
                    onChange={(e) => agir(() => changerRole(m.user_id, orgId, e.target.value))}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td>
                  {!moi && <button className="plai-btn-ghost" onClick={() => { if (window.confirm(`Retirer ${m.email} de l'organisation ?`)) agir(() => retirerMembre(m.user_id, orgId)); }}>Retirer</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

`src/App.jsx` : route `/admin` en lazy.

- [ ] **Step 6 : Tests, build, vérification**

Run : `npx vitest run && npx vite build`
Expected : PASS, build OK.
Vérifier dans le navigateur (compte admin de l'organisation d'essai) : ajouter l'emplacement « Salle 12 » puis « Armoire A » avec parent « Salle 12 » ; le sélecteur affiche « Salle 12 › Armoire A » ; essayer de supprimer « Salle 12 » (parent d'« Armoire A ») → message « encore utilisé ailleurs » et l'élément reste ; changer son propre rôle est désactivé. L'invitation par e-mail réelle n'est PAS envoyée sans l'accord de JF (c'est un envoi externe) : si JF accepte, tester avec une adresse qu'il indique, via `vercel dev` (pas `vite dev`, car `/api/*` n'y tourne pas).

- [ ] **Step 7 : Commit**

```bash
git add -A && git commit -m "feat: administration (emplacements, catégories, membres) et API d'invitation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : Finitions visuelles, installation PWA et accessibilité

**Files:**
- Modify: `src/logistecole.css` (ajustements après relecture visuelle), `index.html` si besoin
- Create: `docs/captures/` (captures de contrôle, facultatif)

**Interfaces:**
- Consumes : toutes les pages.
- Produces : application visuellement cohérente avec la charte (nav, conteneur, footer présents), utilisable à 375 px, installable.

- [ ] **Step 1 : Contrôle visuel sur grand écran et mobile**

Avec `preview_start`, pour `/connexion`, `/` (liste remplie), `/o/<code>`, `/nouveau`, `/scan`, `/etiquettes`, `/admin` : prendre une capture à la taille bureau puis `resize_window` preset `mobile` (375×812). Vérifier : barre de navigation teal avec logo PLAI non déformé (hauteur 32 px, largeur automatique) ; onglets défilables sans débordement horizontal de la page ; pied de page avec logo ; bouton « Scanner » orange pleine largeur ; aucun texte sous 16 px. Mesurer au lieu de supposer :
```js
// javascript_tool
[...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.tagName + ':' + e.textContent.trim().slice(0, 30))
```
Expected : liste vide. Mesurer aussi les cibles :
```js
[...document.querySelectorAll('button, a.plai-btn, input, select')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.outerHTML.slice(0, 60))
```
Expected : liste vide (sauf cases à cocher natives, 24 px dans un libellé de 44 px). Corriger le CSS pour tout écart. Remettre la fenêtre en `desktop` à la fin.

- [ ] **Step 2 : Contrôle clavier et lecteur d'écran**

Parcourir `/connexion` et `/nouveau` au clavier (Tab) : l'ordre est logique, le focus est visible (contour orange), chaque champ est annoncé avec son label et son aide (`read_page` : `aria-describedby` résolu). Corriger si un champ n'est pas relié à son aide.

- [ ] **Step 3 : Installation**

Vérifier dans les outils du navigateur (`javascript_tool` : `fetch('/manifest.webmanifest').then(r => r.json())`) que le manifeste se charge et que `icon.svg` répond 200. Noter dans la recette que l'installation sur écran d'accueil se teste sur téléphone.

- [ ] **Step 4 : Build, tests, commit**

Run : `npx vitest run && npx vite build`
```bash
git add -A && git commit -m "style: finitions charte, mesures de lisibilité et d'accessibilité" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : Déploiement, recette, session-prompt et revue finale

**Files:**
- Create: `docs/recette-socle.md`, `C:\Users\jfbeg\OneDrive\claude-workspace\memory\logistecole-session-prompt.md`

**Interfaces:**
- Consumes : tout ce qui précède.
- Produces : application en ligne sur `https://logistecole.jfb4plai.com`, recette écrite pour JF, fil conducteur de session.

- [ ] **Step 1 : Contrôle complet avant push**

Run : `cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && npx vitest run && npx vite build && git status --short`
Expected : tous les tests PASS, build OK, arbre propre. Relancer les tests SQL (Tâche 2) une dernière fois avec l'accord de JF si la migration a changé depuis.

- [ ] **Step 2 : Pousser sur main**

Run : `git push origin main`
Expected : push réussi.

- [ ] **Step 3 : Configurer Vercel et Supabase (accords de JF requis à chaque service externe)**

1. Lier un seul projet Vercel : `cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && vercel link` (nom `logistecole`). Puis vérifier dans le tableau de bord qu'aucun projet doublon n'a été créé par l'intégration GitHub ; s'il y en a un, `vercel remove <nom> --yes` sur le doublon (leçon des 6 doublons du 2026-08-25).
2. Variables d'environnement (production) avec `printf`, jamais `echo` :
```bash
printf '%s' 'https://dfoaumjleqtxjeaplnna.supabase.co' | vercel env add VITE_SUPABASE_URL production
printf '%s' '<ANON_KEY>' | vercel env add VITE_SUPABASE_ANON_KEY production
printf '%s' '<SERVICE_ROLE_KEY>' | vercel env add SUPABASE_SERVICE_ROLE_KEY production
printf '%s' 'https://logistecole.jfb4plai.com' | vercel env add SITE_URL production
vercel env pull .env.verif --environment production && grep -c . .env.verif && rm .env.verif
```
Les valeurs réelles viennent de JF ou du tableau de bord Supabase ; ne jamais les écrire dans la conversation ni dans un fichier versionné.
3. Supabase > Authentication > URL Configuration : ajouter aux Redirect URLs `https://logistecole.jfb4plai.com/**` et `http://localhost:5173/**` (sans retirer les existantes, projet partagé). Ne pas modifier les modèles d'e-mail ni la durée des OTP (partagés avec les autres apps).
4. Domaine : ajouter `logistecole.jfb4plai.com` au projet Vercel (`vercel domains add logistecole.jfb4plai.com` ou `vercel alias set <déploiement> logistecole.jfb4plai.com`, comme pour les autres apps) ; déployer : `vercel --prod`.

- [ ] **Step 4 : Vérifier la production**

Ouvrir `https://logistecole.jfb4plai.com` : redirection vers `/connexion`, logo, charte. Demander un lien de connexion (e-mail réel : accord de JF) et l'ouvrir ; si le lien renvoie sur une mauvaise adresse, c'est l'étape 3.3 qui manque. Console sans erreur. Vérifier les en-têtes : `curl -sI https://logistecole.jfb4plai.com | grep -i x-robots-tag` → `noindex, nofollow`.

- [ ] **Step 5 : Écrire la recette pour JF**

`docs/recette-socle.md` (chemins et adresses exacts, étapes numérotées, résultat attendu à chaque étape) :
```markdown
# Recette du socle Logistécole

Adresse : https://logistecole.jfb4plai.com
Fichier à imprimer : le PDF téléchargé s'enregistre dans votre dossier Téléchargements (C:\Users\jfbeg\Downloads\etiquettes-logistecole.pdf).

## Préparation
1. Sur l'ordinateur, ouvrez l'adresse ci-dessus et connectez-vous (lien reçu par e-mail).
2. Attendu : la liste du matériel de « Pôle PLAI (essai) », ses 8 catégories dans le filtre.

## A. Créer et étiqueter (ordinateur)
1. Onglet « Ajouter » : nom « Valise de 16 tablettes, salle 12 », catégorie « Tablettes et ordinateurs », quantité 3, une vraie photo. Attendu : vous arrivez sur la page des étiquettes, 3 cases cochées.
2. « Générer le PDF » puis imprimez-le sur papier ordinaire à 100 %. Attendu : 3 étiquettes avec QR, nom, code type ABCD-2345, nom de l'organisation en petit.

## B. Scanner (téléphone)
1. Sur le téléphone, ouvrez l'adresse, connectez-vous, onglet « Scanner », autorisez la caméra.
2. Pointez une étiquette imprimée. Attendu : la fiche de l'objet s'ouvre.
3. Pointez un autre QR (par exemple celui d'un site web). Attendu : message « n'est pas une étiquette Logistécole », la caméra continue.
4. Refusez la caméra (réglages du navigateur) : Attendu : message clair et champ pour saisir le code.

## C. Historique
1. Sur la fiche : changez l'état en « Défectueux ». Attendu : une ligne « État : Bon état → Défectueux » avec la date et votre adresse.
2. Ajoutez une correction. Attendu : ligne « Correction : … ». Aucune ligne existante ne peut être modifiée ou supprimée.

## D. Invitation et isolation (avec un deuxième compte)
1. Administration > Membres : invitez une adresse de test en « Lecture seule ». Attendu : e-mail reçu.
2. Connectée avec ce compte : le matériel est visible mais aucun bouton d'ajout ni de modification n'apparaît, et l'onglet Administration est absent.
3. (N1) Si vous avez une deuxième organisation d'essai, vérifiez qu'un compte de l'une ne voit rien de l'autre.

## E. Installation
1. Menu du navigateur du téléphone > « Ajouter à l'écran d'accueil ». Attendu : une icône Logistécole s'ajoute.
```

- [ ] **Step 6 : Écrire le session-prompt (fil conducteur entre sessions)**

`C:\Users\jfbeg\OneDrive\claude-workspace\memory\logistecole-session-prompt.md` : objectif (alternative gratuite à Hector Asset Manager pour les écoles FWB et le Pôle), stack, règles du projet, décisions prises (organisations à plat, emprunteurs sans compte en v1, historique en écriture seule par triggers, pilote puis v2, gratuit pour les écoles), état d'avancement (liste des 13 tâches cochées), sous-projets restants (2 prêts et scan, 3 import Excel, 4 réservations, 5 pannes, 6 consommables), pièges rencontrés (accords requis avant migration et e-mails, `vercel dev` pour `/api`, doublons Vercel, Redirect URLs Supabase), liens vers la spec et ce plan. Ajouter une ligne à `MEMORY.md` du dossier mémoire automatique selon la procédure habituelle.

- [ ] **Step 7 : Revue finale globale**

Dispatcher une revue de toute la branche (sous-agent ou `/code-review`) en lui donnant la spec, ce plan et la liste « Review Focus » ; corriger les constats avant de déclarer terminé. Vérifier en particulier : (a) aucune politique RLS auto-jointe ; (b) `logi_historique` sans `update` ni `delete` pour tout rôle ; (c) aucune clé dans `dist/` (`grep -r "service_role" dist` ne renvoie rien) ; (d) aucun `console.log` dans `src/` et `api/`.

- [ ] **Step 8 : Commit final et livraison**

```bash
git add -A && git commit -m "docs: recette du socle et état du projet" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git push origin main
```
Puis donner à JF le lien de l'application, le chemin de `docs/recette-socle.md`, et ce qui reste (recette sur téléphones, sous-projets 2 à 6).

---

## Auto-revue du plan

**Couverture de la spec** : organisations à plat (T2), membres et rôles (T2, T11), objets, emplacements, catégories (T2, T6, T8, T11), historique en écriture seule et triggers (T2 + tests SQL), correction par ajout de ligne (T7), état `sorti` et suppression définitive confirmée (T7), emprunteurs préparés (T2, table seule), QR et saisie manuelle (T9), étiquettes avec nom d'organisation (T10), création en lot atomique plafonnée à 100 (T2 RPC, T4, T8), photos compressées côté navigateur dans un bucket privé (T4, T6, T8, T2), import Excel hors périmètre (sous-projet 3), invitations avec plafond (T11), états vides / chargement / erreur (T5, T6, T7), pas de hors-ligne, dit dans l'encart (T6), tests SQL d'isolation (T2), parcours navigateur (T6 à T12), build avant push et recette téléphone (T13), charte et mesures de lisibilité (T12), contact `jf.beguin@outlook.com` (T5).

**Écarts assumés par rapport à la spec** (à signaler à JF) : pas de Tailwind (CSS partagé seul) ; connexion par lien magique et non par mot de passe ; `logi_membres` référence `auth.users` (équivalent à `profiles.id`) et stocke l'e-mail pour l'affichage ; les colonnes `auteur_email` et `cree_le` ont été ajoutées à `logi_historique` et `logi_membres` ; la suppression d'un emplacement ou d'une catégorie utilisée est refusée (restrict) plutôt que silencieuse.

**Cohérence des noms** : `creerObjets` renvoie `{ objet_id, objet_code }` (T2, T6, T8) ; types d'historique identiques entre le SQL (T2) et `libelleEvenement` (T4) ; `useOrg()` expose `orgId`, `orgNom`, `role`, `memberships`, `choisir` partout ; `normaliserCode` / `extraireCodeDepuisTexte` / `formaterCode` identiques entre T3, T7, T8, T9, T10.

**Risques connus** : insertion de test dans `auth.users` (T2 step 5) peut buter sur un trigger d'une autre app ; création de politiques sur `storage.objects` peut exiger un rôle propriétaire dans le SQL Editor ; l'envoi d'e-mails de connexion dépend du fournisseur SMTP du projet partagé (limites horaires), à surveiller pendant le pilote ; les scanners de liens d'e-mail peuvent consommer un lien à usage unique (OTP déjà à 24 h sur le projet).
