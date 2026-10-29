-- Un utilisateur peut lire les organisations dont il est membre actif, même sans
-- organisation active (liste « mes organisations ») ; seule l'organisation
-- active est modifiable. La création passe par le rôle propriétaire.
DROP POLICY tenant_isolation ON "Organization";

CREATE POLICY org_read ON "Organization" FOR SELECT
  USING (
    "id" = app_current_org()
    OR EXISTS (
      SELECT 1 FROM "Membership" m
      WHERE m."organizationId" = "Organization"."id"
        AND m."userId" = app_current_user()
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY org_update ON "Organization" FOR UPDATE
  USING ("id" = app_current_org())
  WITH CHECK ("id" = app_current_org());
