-- Aurum PostgreSQL initialization
-- This runs once on first container start.

-- Enforce append-only on audit_events at the DB level.
-- The application role can INSERT and SELECT but never UPDATE or DELETE.
-- This is enforced after Prisma migrations run via a separate migration step.

-- Create read-only reporting role (used by BI/audit tools)
CREATE ROLE aurum_readonly;
GRANT CONNECT ON DATABASE aurum TO aurum_readonly;
GRANT USAGE ON SCHEMA public TO aurum_readonly;

-- Note: after Prisma migrations run, execute:
--   REVOKE UPDATE, DELETE ON audit_events FROM aurum;
--   REVOKE UPDATE, DELETE ON reserve_snapshots FROM aurum;
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO aurum_readonly;
