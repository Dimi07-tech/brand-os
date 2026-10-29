-- Isolation entre organisations par Row Level Security (§9.1, seconde barrière).
--
-- Principe : les requêtes métier s'exécutent dans une transaction qui fait
--   SET LOCAL ROLE brandos_app;
--   SELECT set_config('app.org_id', '<uuid>', true);
-- (voir withTenant() dans src/tenant.ts). Le rôle brandos_app n'est pas
-- propriétaire des tables : les politiques ci-dessous s'appliquent toujours à lui.
-- Sans app.org_id, il ne voit aucune ligne.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'brandos_app') THEN
    CREATE ROLE brandos_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

-- Le rôle de connexion (propriétaire) doit pouvoir faire SET ROLE brandos_app.
GRANT brandos_app TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO brandos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO brandos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO brandos_app;
-- La table interne de Prisma reste hors d'atteinte (absente de la base fantôme).
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON "_prisma_migrations" FROM brandos_app;
  END IF;
END
$$;

-- Organisation active de la transaction ; NULL si absente ou vide.
CREATE FUNCTION app_current_org() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;

CREATE FUNCTION app_current_user() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

-- Tables métier portant organizationId : accès limité à l'organisation active.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Brand', 'BrandVersion', 'BrandAsset', 'ColorPalette', 'Typography',
    'Design', 'Client', 'Product', 'BusinessDocument', 'DocumentSequence',
    'Subscription', 'Payment', 'UsageRecord', 'AIGeneration', 'AuditLog'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING ("organizationId" = app_current_org())
         WITH CHECK ("organizationId" = app_current_org())', t);
  END LOOP;
END
$$;

-- Organisation : uniquement l'organisation active.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Organization"
  USING ("id" = app_current_org())
  WITH CHECK ("id" = app_current_org());

-- Membres : ceux de l'organisation active, plus ses propres adhésions
-- (pour lister « mes organisations » avant d'en choisir une).
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Membership"
  USING ("organizationId" = app_current_org() OR "userId" = app_current_user())
  WITH CHECK ("organizationId" = app_current_org());

-- Modèles : les modèles globaux (organizationId nul) sont lisibles par tous,
-- mais seuls ceux de l'organisation active sont modifiables.
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_read ON "Template" FOR SELECT
  USING ("organizationId" IS NULL OR "organizationId" = app_current_org());
CREATE POLICY template_write ON "Template" FOR ALL
  USING ("organizationId" = app_current_org())
  WITH CHECK ("organizationId" = app_current_org());

-- Données propres à l'utilisateur.
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON "Notification"
  USING ("userId" = app_current_user())
  WITH CHECK ("userId" = app_current_user());

-- User et Session sont manipulés uniquement par le module d'authentification,
-- sous le rôle propriétaire. brandos_app ne lit que les colonnes publiques
-- d'un utilisateur (affichage des membres d'une équipe).
REVOKE ALL ON "User", "Session" FROM brandos_app;
GRANT SELECT ("id", "name", "email", "avatarUrl") ON "User" TO brandos_app;
