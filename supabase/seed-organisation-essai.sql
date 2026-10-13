-- Crée l'organisation d'essai « Pôle PLAI (essai) » avec JF comme administrateur,
-- et les 8 catégories de départ. À exécuter une seule fois dans le SQL Editor.
select logi_nouvelle_organisation(
  'Pôle PLAI (essai)', 'pole',
  (select id from auth.users where lower(email) = 'jf.beguin@outlook.com')
) as organisation_id;
