// Banc d'essai SQL local : un vrai Postgres (PGlite) avec de quoi imiter Supabase
// (rôles anon / authenticated / service_role, schéma auth, droits par défaut, stockage).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const RACINE = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const IMITATION_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'sub', '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  -- Comme sur Supabase : tous les droits par défaut sur les nouvelles tables et fonctions.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  -- Tables d'AménagActif (présentes en production) dont dépend la fiche enrichie.
  create table ar_chapitres (id uuid primary key default gen_random_uuid(), ordre int, titre text, est_dispositif boolean not null default false);
  create table ar_amenagements (id uuid primary key default gen_random_uuid(), chapitre_id uuid references ar_chapitres(id) on delete cascade,
    ordre int, libelle text, type text, actif boolean not null default true);

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;
`;

export function lireFichier(chemin) {
  return readFileSync(join(RACINE, chemin), 'utf8');
}

export function migrations() {
  return readdirSync(join(RACINE, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// Base neuve avec les migrations demandées (par défaut : toutes, dans l'ordre).
export async function creerBase(fichiers = migrations()) {
  const db = new PGlite();
  await db.exec(IMITATION_SUPABASE);
  for (const f of fichiers) await db.exec(lireFichier(`supabase/migrations/${f}`));
  return db;
}

// Exécute un script de tests SQL ; renvoie le texte de la dernière colonne du dernier SELECT.
export async function executerScript(db, chemin) {
  const resultats = await db.exec(lireFichier(chemin));
  const dernier = [...resultats].reverse().find((r) => r.rows?.length);
  return dernier ? String(Object.values(dernier.rows[0]).pop()) : '';
}
